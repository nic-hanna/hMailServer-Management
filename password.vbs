Dim obApp
On Error Resume Next
Set obApp = CreateObject("hMailServer.Application")

' Authenticate. Without doing this, we won't have permission
' to change any server settings or add any objects to the
' installation.   
Call obApp.Authenticate(WScript.Arguments(0), WScript.Arguments(1))

' Locate the domain we want to add the account to
Dim obDomain
Set obDomain = obApp.Domains.ItemByName(WScript.Arguments(2))

Dim obAccount
Set obAccount = obDomain.Accounts.ItemByAddress(WScript.Arguments(3))

' Set the password to "secret"   
obAccount.Password = WScript.Arguments(1)   

obAccount.Save