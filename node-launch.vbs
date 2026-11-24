Set s = CreateObject("WScript.Shell")
s.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
s.Run "node.exe app\launcher\launcher.js", 0, False
