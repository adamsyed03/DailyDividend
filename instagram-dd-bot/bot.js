'use strict';

const { loadConfig } = require('./config');
const { ProcessedCommentDatabase } = require('./database');
const { InstagramBrowser, InstagramSafetyStop } = require('./instagram');
const { loadJob } = require('./job');

const MAX_BROWSER_DMS_PER_HOUR = 30;
const MAX_BROWSER_DMS_PER_DAY = 100;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function log(level, message) {
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const output = `[${time}] ${level}: ${message}`;
  if (level === 'ERROR' || level === 'CRITICAL') console.error(output);
  else console.log(output);
}

function sendingWindow(database, job) {
  const now = new Date();
  const hourlyLimit = Math.min(MAX_BROWSER_DMS_PER_HOUR, Math.max(1, Number(job.maxDmsPerHour) || 10));
  const dailyLimit = Math.min(MAX_BROWSER_DMS_PER_DAY, Math.max(1, Number(job.maxDmsPerDay) || 30));
  const hourStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const hourlyTimestamps = database.sentDmTimestampsSince(hourStart);
  const hourly = hourlyTimestamps.length;
  const daily = database.countSentDmsSince(dayStart.toISOString());
  if (daily >= dailyLimit) {
    return { blocked: true, waitMs: 0, message: `Daily DM limit reached (${daily}/${dailyLimit}). Resume tomorrow.` };
  }

  let nextAllowedAt = now.getTime();
  if (hourly >= hourlyLimit) {
    nextAllowedAt = Math.max(nextAllowedAt, Date.parse(hourlyTimestamps[0]) + 60 * 60 * 1000);
  }
  const latest = database.latestSentDmAt();
  if (latest) {
    const evenSpacingMs = Math.ceil((60 * 60 * 1000) / hourlyLimit);
    nextAllowedAt = Math.max(nextAllowedAt, Date.parse(latest) + evenSpacingMs);
  }
  const waitMs = Math.max(0, nextAllowedAt - now.getTime());
  return {
    blocked: false,
    waitMs,
    message: waitMs > 0
      ? `Rate pacing: next DM slot in ${Math.ceil(waitMs / 1000)} second(s) (${hourlyLimit}/hour, ${dailyLimit}/day).`
      : ''
  };
}

async function waitForSendSlot(database, job, shouldStop) {
  let announcedWait = false;
  while (!shouldStop()) {
    const window = sendingWindow(database, job);
    if (window.blocked) return window;
    if (window.waitMs <= 0) return window;
    if (!announcedWait) {
      log('INFO', window.message);
      announcedWait = true;
    }
    await delay(Math.min(window.waitMs, 15000));
  }
  return { blocked: true, waitMs: 0, message: 'Stop requested while waiting for the next paced DM slot.' };
}

async function main() {
  const allowed = new Set(['--login-only', '--dry-run', '--dm-preview', '--live']);
  const unknown = process.argv.slice(2).filter(argument => !allowed.has(argument));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(', ')}`);

  const dryRun = process.argv.includes('--dry-run');
  const dmPreview = process.argv.includes('--dm-preview');
  const live = process.argv.includes('--live');
  if (live) log('WARNING', 'LIVE MODE: INSTAGRAM PUBLIC REPLIES AND DMS MAY BE SENT.');
  else if (dmPreview) log('INFO', 'DM PREVIEW: the conversation may be opened, but no text can be entered or sent.');
  else if (dryRun) log('INFO', 'DRY RUN: comments may be read, but no public reply or DM can be sent.');
  else log('INFO', 'LOGIN-ONLY MODE: no Instagram replies or DMs can be sent.');

  const browser = new InstagramBrowser(loadConfig(), log);
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    log('INFO', 'Closing the Instagram browser safely.');
    await browser.close();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);

  try {
    await browser.start();
    if (dryRun || dmPreview || live) {
      const job = await loadJob();
      const database = dmPreview ? null : await ProcessedCommentDatabase.open();
      const rotationIndex = database ? database.getRotationIndex() : 0;
      let newMatchCount = 0;
      let existingMatchCount = 0;
      const recordMatches = database ? async comments => {
        for (const comment of comments) {
          const publicReply = job.commentReplies[(rotationIndex + newMatchCount) % job.commentReplies.length];
          const stored = database.recordDryRun(comment, job, publicReply);
          if (!stored.inserted) {
            existingMatchCount += 1;
            continue;
          }
          newMatchCount += 1;
          if (newMatchCount <= 20) {
            log('INFO', `QUEUED: @${comment.username} wrote "${comment.text}"; saved durably in SQLite.`);
          } else if (newMatchCount === 21) {
            log('INFO', 'Additional new matches will be queued without one log line each.');
          }
        }
      } : null;
      try {
        const result = await browser.scanPostDryRun(job, !live, recordMatches);
        if (dmPreview) {
          if (!result.matches.length) throw new Error(`No comment matched "${job.triggerComment}"; no conversation was opened.`);
          await browser.previewPublicReply(result.matches[0]);
          await browser.previewDirectMessage(result.matches[0]);
          log('INFO', 'Phase 4 preview complete: reply and DM composers opened, zero custom text entered, zero actions sent.');
          return;
        }
        if (live) {
          const configuredHourly = Number(job.maxDmsPerHour) || 10;
          const configuredDaily = Number(job.maxDmsPerDay) || 30;
          if (configuredHourly > MAX_BROWSER_DMS_PER_HOUR || configuredDaily > MAX_BROWSER_DMS_PER_DAY) {
            log('WARNING', `Browser safety caps applied: ${MAX_BROWSER_DMS_PER_HOUR}/hour and ${MAX_BROWSER_DMS_PER_DAY}/day.`);
          }
          let completedCount = 0;
          let publicReplySentCount = 0;
          let dmSentCount = 0;
          let skippedCount = 0;
          let failedCount = 0;
          let commentsPageReady = true;
          const uniqueAccountCount = new Set(result.matches.map(comment => comment.username.toLowerCase())).size;
          log('INFO', `Comment-level reply queue: ${result.matches.length} matching comment(s) from ${uniqueAccountCount} unique account(s).`);

          for (const comment of result.matches) {
            const publicReply = job.commentReplies[database.getRotationIndex() % job.commentReplies.length];
            const prepared = database.prepareLive(comment, job, publicReply);
            if (!prepared.eligible) {
              skippedCount += 1;
              log('INFO', `SKIPPED COMMENT: @${comment.username}'s matching comment is already ${prepared.reason}.`);
              continue;
            }

            let stage = prepared.record.public_reply_status === 'SENT' ? 'dm' : 'public_reply';
            let existingPublicReply = false;
            try {
              const dmMessage = [job.directMessage.text, job.directMessage.link].filter(Boolean).join('\n');
              if (prepared.record.public_reply_status !== 'SENT') {
                if (!commentsPageReady) {
                  log('INFO', 'Returning to the configured reel before processing the next comment.');
                  await browser.openPostComments(job.postUrl);
                  commentsPageReady = true;
                }
                existingPublicReply = await browser.hasExistingPublicReply(comment);
                if (existingPublicReply) {
                  database.confirmPublicReplySent(prepared.record.id);
                  stage = 'dm';
                  log('INFO', `SKIPPED PUBLIC REPLY: @ruchivgala has already replied to @${comment.username}'s comment.`);
                }
              }

              if (!prepared.dmAlreadySent) {
                const slot = await waitForSendSlot(database, job, () => closing);
                if (slot.blocked) {
                  log('WARNING', `${slot.message} Comment remains DETECTED for a later run.`);
                  break;
                }
              }

              database.markSending(prepared.record.id);
              if (prepared.record.public_reply_status !== 'SENT' && !existingPublicReply) {
                if (!commentsPageReady) {
                  log('INFO', 'Returning to the configured reel before processing the next comment.');
                  await browser.openPostComments(job.postUrl);
                  commentsPageReady = true;
                }
                await browser.sendPublicReply(comment, publicReply);
                database.markPublicReplySent(prepared.record.id);
                publicReplySentCount += 1;
              } else {
                log('INFO', `RESUME: @${comment.username}'s public reply is already SENT; it will not be posted again.`);
              }
              stage = 'dm';
              if (prepared.dmAlreadySent) {
                database.markDmNotRequired(prepared.record.id);
                completedCount += 1;
                log('INFO', `SENT: public reply handled for @${comment.username}; DM skipped because this account already received one for this post.`);
                continue;
              }
              await browser.sendDirectMessage(comment, dmMessage);
              commentsPageReady = false;
              database.markDmSent(prepared.record.id);
              dmSentCount += 1;
              completedCount += 1;
              log('INFO', existingPublicReply
                ? `SENT: standardized DM for @${comment.username}; existing @ruchivgala public reply was preserved.`
                : `SENT: one public reply and one standardized DM for @${comment.username}.`);
            } catch (error) {
              failedCount += 1;
              database.markFailed(prepared.record.id, stage, error.message);
              log('ERROR', `FAILED for @${comment.username} during ${stage}: ${error.message}`);
              if (error instanceof InstagramSafetyStop) throw error;
              if (stage === 'public_reply') {
                log('WARNING', 'Stopping this live pass after a public-reply UI failure to prevent cascading attempts.');
                break;
              }
            }
          }
          const queue = database.queueSummary(job.postUrl);
          log('INFO', `Persistent queue: ${queue.total} recorded comment(s); ${JSON.stringify(queue.statuses)}.`);
          log('INFO', `Live pass complete: ${result.matches.length} matching comment(s), ${uniqueAccountCount} unique account(s); ${publicReplySentCount} public reply/replies and ${dmSentCount} DM(s) sent, ${completedCount} comment(s) completed, ${skippedCount} skipped, ${failedCount} failed.`);
          return;
        }

        const queue = database.queueSummary(job.postUrl);
        log('INFO', `Persistent queue: ${queue.total} recorded comment(s); ${JSON.stringify(queue.statuses)}.`);
        log('INFO', `SQLite dry-run complete: ${newMatchCount} new, ${existingMatchCount} already recorded; zero replies and zero DMs sent.`);
      } finally {
        if (database) database.close();
      }
    } else await browser.openForManualLogin();
  } catch (error) {
    if (error instanceof InstagramSafetyStop) {
      log('CRITICAL', `SAFETY STOP: ${error.message}`);
      process.exitCode = 3;
    } else {
      throw error;
    }
  } finally {
    await close();
  }
}

main().catch(error => {
  log('ERROR', error.stack || error.message);
  process.exitCode = 1;
});
