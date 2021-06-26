# hMailServer-Management

This software creates a web server using NodeJS that interacts with hMailServer to allow regular users to change their own passwords without having to have admin access to hMailServer and any users with admin access (who may not have access to the server) can change another person's password and create regular (non-admin) users.

## Requirements
- HMailServer
- NodeJS
- MYSQL databse (credentials and ability to create a simple table)
- Ability to host web server on the same system as hmailserver

## Setup
- Create a database with the following columns: **cookie**, **account** (account should be unique)
```
CREATE TABLE `cookies` (
  `cookie` text NOT NULL,
  `account` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `cookies`
  ADD UNIQUE KEY `cookie` (`cookie`) USING HASH;
```
- Enter your database and HMailServer details in the .env file
- Customise the Logo and Favicons
- Download NodeJS and run **npm i** to initiate the server.
- Start with **node index.js**
