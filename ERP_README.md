# Complete Fitness Store ERP

A production-ready full-stack ERP system for fitness retail businesses with inventory management, sales (POS), financial tracking, and tax compliance.

## 🚀 Features

- **Dark & Gold Theme** (#1A0D12 / #FFE699) - Modern, professional design
- **Role-Based Access Control** - Admin and Vendedor (Seller) roles
- **Dashboard** - Real-time KPIs and business metrics
- **Sales (PDV)** - Point of Sale terminal with real-time processing
- **Product Management** - Catalog with intelligent margin-based pricing
- **Stock Management** - Inventory tracking with low-stock alerts
- **Financial Module** - Cash flow, receivables, payables
- **Fiscal Compliance** - Invoice management (NFe, NFC-e) with SEFAZ integration
- **JWT Authentication** - Secure API with role-based authorization

## 📋 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS v3.4
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL (production) / Mock data (development)
- **Auth**: JWT + RBAC (Role-Based Access Control)

## 🔐 Demo Credentials

### Admin User
- **Email**: `admin@completefitness.com.br`
- **Password**: `password123`
- **Permissions**: Full access to all modules

### Seller User
- **Email**: `vendedor@completefitness.com.br`
- **Password**: `password123`
- **Permissions**: Sales, limited dashboard

## 🏃 Getting Started

### Installation

```bash
# Install dependencies
npm install
# or
pnpm install
```

### Development

```bash
# Start dev server (both frontend & backend)
npm run dev
```

The app will be available at `http://localhost:5173`

### Building

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 📚 API Documentation

### Authentication

#### Login
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "vendedor@completefitness.com.br",
  "password": "password123"
}

Response (200 OK):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_90213",
    "name": "Ana Paula - Vendas",
    "email": "vendedor@completefitness.com.br",
    "role": "vendedor"
  }
}
```

All protected routes require: `Authorization: Bearer {token}`

### Dashboard

#### Get Metrics
```
GET /api/v1/dashboard/metrics
Authorization: Bearer {token}

Response (200 OK):
{
  "totalRevenue": 45320.50,
  "totalExpenses": 18900.20,
  "netProfit": 26420.30,
  "salesCount": 142,
  "productsInStock": 287,
  "lowStockProducts": 12,
  "averageMargin": 125
}
```

### Products

#### List Products
```
GET /api/v1/products
Authorization: Bearer {token}
```

#### Create Product (Admin Only)
```
POST /api/v1/products
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "TOP-ESS-P",
  "name": "Top Fitness Essential Black",
  "category": "Roupas",
  "size": "P",
  "cost": 25.00,
  "margin": 120.00,
  "stock": 30,
  "minStock": 10
}

Note: Price is calculated automatically as: cost × (1 + margin / 100)
```

#### Update Product (Admin Only)
```
PUT /api/v1/products/{id}
Authorization: Bearer {token}
```

#### Delete Product (Admin Only)
```
DELETE /api/v1/products/{id}
Authorization: Bearer {token}
```

### Sales (POS)

#### Create Sale
```
POST /api/v1/sales
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "usr_90213",
  "clientName": "Carlos Silva",
  "items": [
    {
      "productId": "prod_001",
      "quantity": 2,
      "unitPrice": 100.00,
      "totalPrice": 200.00
    }
  ],
  "subtotal": 200.00,
  "discount": 20.00,
  "total": 180.00,
  "paymentMethod": "pix"
}

Automatic side effects:
1. Stock decreased for each product
2. Stock movement recorded
3. Financial entry (revenue) created
```

#### List Sales
```
GET /api/v1/sales
Authorization: Bearer {token}
```

### Stock Management

#### Create Stock Movement (Admin Only)
```
POST /api/v1/stock/movements
Authorization: Bearer {token}
Content-Type: application/json

{
  "productId": "prod_001",
  "type": "input",
  "quantity": 20,
  "reason": "Reposição de estoque"
}

type: "input" | "output"
```

#### List Stock Movements
```
GET /api/v1/stock/movements
Authorization: Bearer {token}
```

### Financial

#### Create Financial Entry (Admin Only)
```
POST /api/v1/financial/entries
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "revenue",
  "description": "Venda de produtos",
  "amount": 5200.00,
  "category": "Venda de Produtos",
  "status": "paid",
  "dueDate": "2024-01-15"
}
```

#### List Financial Entries
```
GET /api/v1/financial/entries
Authorization: Bearer {token}
```

### Fiscal / Invoicing

#### Emit Invoice (Admin Only)
```
POST /api/v1/fiscal/invoice
Authorization: Bearer {token}
Content-Type: application/json

{
  "number": "NF-001",
  "type": "NFe",
  "clientName": "ABC Fitness",
  "amount": 5200.00
}

type: "NFe" | "NFC-e"
```

#### List Invoices
```
GET /api/v1/fiscal/invoices
Authorization: Bearer {token}
```

#### Download Invoice XML
```
GET /api/v1/fiscal/invoices/{id}/xml
Authorization: Bearer {token}
```

## 💼 Business Rules

### Price Calculation
Prices are calculated using the margin-based formula:
```
Price = Cost × (1 + Margin / 100)
```

Example: Cost R$40 + 150% margin = R$100

### Stock Alerts
Low stock alert triggers when:
```
Current Stock ≤ Minimum Stock
```

### Valid Size Variants
- PP, P, M, G, GG, XG
- Plus Size
- Único (for accessories)

### Payment Methods
- PIX
- Money (Dinheiro)
- Credit Card
- Debit Card

### Financial Status
- **Paid**: Transaction completed
- **Pending**: Awaiting payment

## 🔒 Role Permissions

| Module | Admin | Vendedor |
|--------|-------|----------|
| Dashboard | Full | Limited |
| Sales (PDV) | Full | Full |
| Products | Full CRUD | Read Only |
| Stock | Full | Input Only |
| Financial | Full | None |
| Fiscal | Full | None |

## 📦 Project Structure

```
client/
  ├── pages/           # Route components
  │   ├── Login.tsx
  │   ├── Dashboard.tsx
  │   ├── Vendas.tsx
  │   ├── Produtos.tsx
  │   ├── Estoque.tsx
  │   ├── Financeiro.tsx
  │   └── Fiscal.tsx
  ├── components/      # Reusable components
  │   └── Layout.tsx   # Main layout with navigation
  └── global.css       # TailwindCSS theming

server/
  ├── routes/          # API endpoints
  │   ├── auth.ts
  │   ├── dashboard.ts
  │   ├── products.ts
  │   ├── sales.ts
  │   ├── stock.ts
  │   ├── financial.ts
  │   └── fiscal.ts
  ├── auth.ts          # JWT utilities
  └── index.ts         # Express setup

shared/
  └── api.ts           # Shared types & interfaces
```

## 🎨 Design System

### Colors
- **Background**: #1A0D12 (Dark)
- **Accent**: #FFE699 (Gold)
- **Surface**: #2D1B24
- **Border**: #3D2B32
- **Success**: #4ade80
- **Error**: #f87171
- **Warning**: #facc15

### Components
- Card: `.card-dark`
- Button: `.btn-gold`, `.btn-gold-sm`
- Status indicators with semantic colors

## 🔧 Environment Variables

```env
JWT_SECRET=your-secret-key
PING_MESSAGE=pong
DATABASE_URL=postgresql://...  # When using PostgreSQL
```

## 📝 Notes

- Currently uses mock data for demonstration
- To integrate PostgreSQL, update routes to use Drizzle ORM
- JWT secret should be changed before production
- All numeric calculations use fixed-point arithmetic for precision
- Stock movements are audit trails for inventory
- All sales automatically create financial entries for reporting

## 🚀 Production Deployment

1. Set up PostgreSQL database
2. Update `.env` with database credentials
3. Migrate routes to use Drizzle ORM (currently using mock arrays)
4. Configure proper JWT secret
5. Set up SEFAZ integration for real fiscal invoicing
6. Enable HTTPS
7. Configure CORS for production domain
8. Deploy using Netlify or Vercel

## 📞 Support

For issues or feature requests, refer to the technical specification document: `especificacao_integracao_erp.pdf`
