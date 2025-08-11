# Requirements

## Tech Stack
* RemixJS Framework
* React library
* Mantine UI Framework
* Nivo Charts
* Typescript
* Vite
* Docker Container Deployment
* postgresql database

## Summary
This is a personal finance application designed to be self-hosted at home. This application will allow for multiple account books that can be switched between. Each account book will contain accounts and each account will have a list of transactions. The account book is the parent of all other objects.

## Requirement 1
There should be a .env file that can be used to provide snesitive information like API keys, database URL, usernames and passwords.

## Requirement 2
As a user when I first load the application I expect to see a landing screen that lets me choose which account book I want to open. 
From this screen I should be able to create new Account Books, each account book has a name and updatedAt date and save it to the database.
When I click on a preexisting account book then I should be taken to the account book dashboard. 

## Requirement 3
As a user when I am on the dashbaord I should be able to create new accounts and save it to a database. An account has a name, total monthly balance, total monthly debits, total monthly credits, updatedAt date and is linked to the currently selected account book. Each account will have a historical monthly balance.

## Requirement 4
As a user when I am on the dashboard, I should be able to upload a QIF file that contains transactions which is read by the application and then saved to the database. When preparing to upload the file I should be able to select the account which the transactions will be linked to. Each transaction will have an ID, transaction date, description, catagory, sub catagory, debit amount, credit amount, and a link to another transaction if it is a tranfer.

## Requirement 5
As a user while on the dashboard I want to see a line chart for each account that plots the monthly balance.

## Requirement 6
As a user I should see a navigation bar at the top of the dashbaord a button that has the label "Transactions". When I click on it I should be taken to the transaction page where I can select an account and view all its listed transactions for a given month.