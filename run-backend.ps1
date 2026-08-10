$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$root\backend\.venv\Scripts\python.exe" -m uvicorn voxrox.app:app --host 127.0.0.1 --port 8000 --app-dir "$root\backend" --reload
