Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & currentDir & "\offline_server.ps1""", 1, False
