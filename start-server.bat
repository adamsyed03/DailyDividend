@echo off
echo Starting Daily Dividend Local Server...
echo.
echo Choose your preferred method:
echo 1. Node.js serve (if available)
echo 2. PHP server (if available)
echo 3. Open directly in browser
echo.
echo Trying Node.js serve first...
npx serve . --listen 8000
if %errorlevel% neq 0 (
    echo.
    echo Node.js serve not available. Trying PHP...
    php -S localhost:8000
    if %errorlevel% neq 0 (
        echo.
        echo Neither Node.js nor PHP available.
        echo Opening index.html directly in browser...
        start index.html
        echo.
        echo Note: Some features may not work when opening directly.
        echo For full functionality, install Node.js or Python.
    )
)
pause
