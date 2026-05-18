"""nanobot setup - compiles to single .exe, extracts and installs on run"""
import os, shutil, sys, zipfile
from pathlib import Path

def main():
    print("nanobot AI Assistant - Installing...")
    target = Path(os.environ["USERPROFILE"]) / "nanobot"

    if getattr(sys, 'frozen', False):
        zip_path = os.path.join(sys._MEIPASS, "nanobot_data.zip")
    else:
        zip_path = "nanobot_data.zip"

    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)

    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(target)
    print(f"Installed to {target}")

    # Desktop shortcut via PowerShell (no extra deps)
    ps = (
        "$w=New-Object -ComObject WScript.Shell;"
        "$d=$w.SpecialFolders('Desktop');"
        f"$l=$w.CreateShortcut($d+'\\nanobot.lnk');"
        f"$l.TargetPath='{target}\\nanobot.exe';"
        f"$l.WorkingDirectory='{target}';"
        f"$l.IconLocation='{target}\\nanobot.exe,0';"
        "$l.Save()"
    )
    import subprocess
    subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True)
    print("Desktop shortcut created")

    os.startfile(str(target / 'nanobot.exe'))
    print("nanobot launched!")

if __name__ == '__main__':
    main()
