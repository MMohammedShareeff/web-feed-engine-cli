# Web Aggregator

A simple RSS feed aggregator CLI built with TypeScript, PostgreSQL and Drizzle ORM.

## Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)

## Installation
1. Clone the project and go into the folder:
   git clone https://github.com/MMohammedShareeff/web-feed-engine-cli
   cd web-aggregator

2. Install dependencies:
   npm install

## Configuration
{
    "db_url": "postgres://postgres:postgres@localhost:5432/gator?sslmode=disable",
    "current_user_name": "titititi"
}

if you 

## Database Setup
1. Create database:
   Linux/macOS:
   sudo -u postgres psql -c "CREATE DATABASE gator;"

   Windows: Use pgAdmin or psql and run:
   CREATE DATABASE gator;

2. Run migrations:
   npx drizzle-kit migrate

## Running the Program
The program is started with:
npm start

Then you type the command name + arguments.

## Available Commands

- register <name> → Create new user and login
- login <name> → Login as existing user
- users → List all users
- reset → Delete all users (dangerous)
- addfeed <name> <url> → Add a new feed (must be logged in)
- feeds → List all feeds
- follow <url> → Follow a feed (must be logged in)
- following → List feeds you are following (must be logged in)
- unfollow <url> → Unfollow a feed (must be logged in)
- browse [limit] → Browse latest posts (default limit 2, must be logged in)
- agg <duration> → Start continuous feed aggregator (e.g. 10s, 1m, 1h)

## Usage Examples

npm start register john
npm start login john
npm start addfeed "My Blog" "https://gitlab.com/crossref/schema/-/blob/master/best-practice-examples/dataset.5.3.0.xml"
npm start follow "https://gitlab.com/crossref/schema/-/blob/master/best-practice-examples/dataset.5.3.0.xml"

npm start following
npm start browse 5
npm start agg 30s
above agg command code be either in seconds s, minutes m, hours h

## Quick Start
1. npm install
2. Create .gatorconfig.json
3. Create database + run migrations
4. npm start register yourname
5. npm start addfeed "Test Feed" https://www.wagslane.dev/index.xml
6. npm start follow https://www.wagslane.dev/index.xml
7. npm start browse

You are ready to use the aggregator!