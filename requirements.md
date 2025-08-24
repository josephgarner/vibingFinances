# Requirements

## Tech Stack

- RemixJS Framework
- React library
- Mantine UI Framework
- Nivo Charts
- Typescript
- Vite
- Docker Container Deployment
- postgresql database

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

## Requirement 7

As a user I should be able to update the Catagory and Subcatagory of a transaction. When editing the Catagory and Subcatagory of a transaction I should be able to pick from a list of existing catagories or have the choice to create a new one. I should also have the ability to update multiple transactions at once.

## Requirement 8

As a user Ishould be able to create category rules that are applied to transactions when they are first imported. these rules can be viewd and added on a new page called "Rules". the rules will use key word matching based on the description of the transaction. As a user I should also have the abbility to run these rules on existing transactions that are not catagorised.
As a user I should see a navigation bar at the top of the dashbaord a button that has the label "Transactions". When I click on it I should be taken to the transaction page where I can select an account and view all its listed transactions for a given month.

## Requirement 9
As a user I want to be able to have the ability to split purchases between any number of people on a percentage basis.
As a user I will want to click on the `Split Calculator` button in the navigation pane and be taken to the `Split Payment Calculator` Page. On this page I should be able to add items to a list that I want to split, these items will have a name and a total amount. I then want to add the number of splits that this item will be deivided up by. I then want to be able to assign different percentages that each split is responsible for contributing the total should be no more then 100%.  I then want to see the cash amount each split has to pay per item based on the allocated percentage.
As a user I will want to save these split lists to the database in case I want to look at them later. On the far right side of the page should be a list of all the previous splits that I can select from.
As a user I should also have the option to `Save`, `Update`, `Clear` and `Delete` the current split
These splits will need to be linked to the account book.

## Requirement 10
As a user I want to be able to create a budget based on my Income amount.
As A user I want to click on the `Flow Budget` button in the nav pane and be take to the `Flow Budget` Page. Here I will be able to enter my income and select which account it is deposited into.
As a user I want to be able to add buckets that money will move into on a monthly basis based from my desginated income account. These bucket can either be an account or just have a custom label if they are for an account not being tracked.
As a user I want to be able to set either a fixed dollar amount to be transfered from my income account or a percentage of my income. It should be a one to many relationship where there is 1 income account and many recieving accounts
As a user I want to save this budget to the database to be reteived later as well as update it when needed.
As a user I expect to see a Sankey graph displaying the amount that is being transfered from the income account into the many reciving accounts. This graph should sit to the right of the screen with the accounts and inputs on the left.
This budget will need to be linked to the account book.
