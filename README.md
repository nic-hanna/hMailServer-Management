# HMailServer-Management

This software creates a web server using NodeJS that interacts with hmailserver to allow regular users to change their own passwords without having to have admin access and with any users with admin access (who may not have access to the server) can change another person's password and create regualr (non-admin) users.

## Setup
- Create a database with the following columns: cookie, account (account should be unique)
- Enter your database and HMailServer details in the .env file
- Customise the Logo and Favicons
- Download NodeJS and run **npm i** to initiate the server.
- Start with **node index.js**
