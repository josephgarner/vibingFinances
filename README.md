# Personal Finances Application

A server-side rendered application for managing personal finances built with RemixJS, React, Mantine UI, and Nivo Charts.

## Features

- Multiple account books management
- Account creation and management
- Transaction tracking and categorization
- **QIF file upload and parsing** - Import transactions from QIF files
- Monthly balance charts using Nivo
- Transaction filtering by account and month
- Modern UI with Mantine components
- **PostgreSQL database integration** for persistent storage
- **Auto-generated UUIDs** for all primary keys

## Tech Stack

- **Framework**: RemixJS
- **UI Library**: React
- **UI Framework**: Mantine UI
- **Charts**: Nivo Charts
- **Language**: TypeScript
- **Build Tool**: Vite
- **Database**: PostgreSQL with Drizzle ORM
- **Deployment**: Docker

## Prerequisites

- Node.js 22 or higher
- PostgreSQL database
- Docker (optional, for containerized deployment)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd PersonalFinances
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your database credentials and other settings
```

4. Set up the database:
```bash
# Create a PostgreSQL database named 'personal_finances'
createdb personal_finances

# Generate database migrations
npm run db:generate

# Run migrations to create tables
npm run db:migrate
```

## Database Setup

### Using Docker (Recommended)

1. Start PostgreSQL with Docker:
```bash
docker run --name personal-finances-db \
  -e POSTGRES_DB=personal_finances \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15-alpine
```

2. Update your `.env` file:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/personal_finances
```

3. Run migrations:
```bash
npm run db:migrate
```

### Manual PostgreSQL Setup

1. Install PostgreSQL on your system
2. Create a database:
```sql
CREATE DATABASE personal_finances;
```

3. Update your `.env` file with the correct connection string
4. Run migrations:
```bash
npm run db:migrate
```

## Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Database Management

### Generate Migrations
When you make changes to the schema, generate new migrations:
```bash
npm run db:generate
```

### Run Migrations
Apply pending migrations to the database:
```bash
npm run db:migrate
```

### Database Studio
View and manage your database with Drizzle Studio:
```bash
npm run db:studio
```

## Database Schema

### Tables

1. **`account_books`** - Stores account book information
   - `id` (UUID, Primary Key, Auto-generated)
   - `name` (Text, Required)
   - `updated_at` (Timestamp, Auto-generated)
   - `created_at` (Timestamp, Auto-generated)

2. **`accounts`** - Stores account information
   - `id` (UUID, Primary Key, Auto-generated)
   - `name` (Text, Required)
   - `total_monthly_balance` (Decimal, Default: 0)
   - `total_monthly_debits` (Decimal, Default: 0)
   - `total_monthly_credits` (Decimal, Default: 0)
   - `updated_at` (Timestamp, Auto-generated)
   - `created_at` (Timestamp, Auto-generated)
   - `account_book_id` (UUID, Foreign Key to account_books)
   - `historical_balance` (JSONB, Default: [])

3. **`transactions`** - Stores transaction information
   - `id` (UUID, Primary Key, Auto-generated)
   - `transaction_date` (Timestamp, Required)
   - `description` (Text, Required)
   - `category` (Text, Required)
   - `sub_category` (Text, Required)
   - `debit_amount` (Decimal, Default: 0)
   - `credit_amount` (Decimal, Default: 0)
   - `linked_transaction_id` (UUID, Optional)
   - `account_id` (UUID, Foreign Key to accounts)
   - `account_book_id` (UUID, Foreign Key to account_books)
   - `created_at` (Timestamp, Auto-generated)
   - `updated_at` (Timestamp, Auto-generated)

### Key Features

- **Auto-generated UUIDs**: All primary keys are automatically generated UUIDs
- **Foreign Key Relationships**: Proper referential integrity with cascade deletes
- **JSONB Storage**: Historical balance data stored as JSONB for flexibility
- **Timestamps**: Automatic creation and update timestamps
- **Decimal Precision**: Financial amounts stored with 10,2 precision

## QIF File Support

The application supports importing transactions from QIF (Quicken Interchange Format) files. 

### QIF File Format

QIF files should follow the standard format:
```
!Type:Bank
D01/15/2024
T-125.50
PStarbucks Coffee
LCoffee
SFood & Dining
^
```

### Supported QIF Fields

- `D` - Date (MM/DD/YYYY or MM/DD/YY)
- `T` - Transaction amount (positive for credits, negative for debits)
- `P` - Payee/Description
- `L` - Category
- `S` - Sub-category
- `M` - Memo (additional description)

### Uploading QIF Files

1. Navigate to the dashboard of an account book
2. Click "Upload QIF File"
3. Select the account to link transactions to
4. Choose your QIF file
5. Click "Upload"

The application will:
- Parse the QIF file
- Extract transaction data
- Save transactions to the database (with auto-generated UUIDs)
- Update account totals automatically
- Display success/error notifications

## Production Deployment

### Using Docker

1. Build and run with Docker Compose:
```bash
docker-compose up --build
```

2. Or build and run manually:
```bash
# Build the Docker image
docker build -t personal-finances .

# Run the container
docker run -p 3000:3000 -e DATABASE_URL=your_database_url personal-finances
```

### Manual Deployment

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Usage

1. **Account Books**: Start by creating an account book on the landing page
2. **Accounts**: Within each account book, create accounts to track different financial categories
3. **Transactions**: Upload QIF files or manually add transactions to accounts
4. **Charts**: View monthly balance charts for each account
5. **Transactions Page**: Filter and view transactions by account and month

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/personal_finances`)
- `NODE_ENV`: Environment (development/production)
- `PORT`: Application port (default: 3000)

## Project Structure

```
app/
├── routes/                 # Application routes
│   ├── _index.tsx         # Landing page (account book selection)
│   ├── dashboard.$accountBookId.tsx  # Dashboard for account book
│   └── transactions.$accountBookId.tsx  # Transactions page
├── utils/                 # Utility functions
│   ├── qifParser.ts       # QIF file parsing
│   └── database.ts        # Database operations
├── db/                    # Database configuration
│   ├── schema.ts          # Database schema
│   ├── index.ts           # Database connection
│   └── migrate.ts         # Migration script
├── root.tsx               # Root layout with Mantine provider
└── entry.client.tsx       # Client entry point
drizzle/                   # Database migrations
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
