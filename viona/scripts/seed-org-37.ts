/**
 * Seed Script for Viona Database
 * 
 * Generates fake data for org_id: 37, user_id: 6
 * 
 * Usage:
 *   npx ts-node scripts/seed-org-37.ts
 *   OR
 *   npx tsx scripts/seed-org-37.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORG_ID = BigInt(1);
const USER_ID = BigInt(1);

const PRODUCTS = [
  // Laptops
  { name: 'Acer Predator Helios 16', sku: 'ACR-PH16', price: 1999, description: 'i9, RTX 4070, 16GB RAM' },
  { name: 'HP Spectre x360', sku: 'HP-SPX360', price: 1499, description: 'Touchscreen, Convertible Laptop' },
  { name: 'Asus ROG Zephyrus G14', sku: 'ASUS-G14', price: 1699, description: 'Ryzen 9, Gaming Laptop' },
  { name: 'MSI Stealth 15M', sku: 'MSI-S15M', price: 1899, description: 'Ultra thin gaming laptop' },

  // Phones
  { name: 'OnePlus 12', sku: 'OP-12', price: 899, description: 'Snapdragon Gen 3' },
  { name: 'Nothing Phone 2', sku: 'NP-2', price: 699, description: 'Glyph Interface' },
  { name: 'Xiaomi 14 Pro', sku: 'XM-14P', price: 999, description: 'Leica Camera' },

  // Tablets
  { name: 'Lenovo Tab P12', sku: 'LEN-P12', price: 599, description: 'Stylus support' },
  { name: 'Realme Pad X', sku: 'RM-PADX', price: 349, description: 'Affordable tablet' },

  // Audio
  { name: 'JBL Live 660NC', sku: 'JBL-660', price: 199, description: 'Wireless ANC headphones' },
  { name: 'Sennheiser Momentum 4', sku: 'SEN-M4', price: 379, description: 'Premium sound quality' },
  { name: 'Boat Airdopes 441', sku: 'BOAT-441', price: 49, description: 'Budget earbuds' },

  // Gaming
  { name: 'Steam Deck', sku: 'STM-DCK', price: 499, description: 'Portable gaming PC' },
  { name: 'Asus ROG Ally', sku: 'ROG-ALLY', price: 699, description: 'Handheld console' },
  { name: 'Logitech G Cloud', sku: 'LOG-GC', price: 349, description: 'Cloud gaming handheld' },

  // Accessories
  { name: 'Razer Basilisk V3', sku: 'RAZ-BV3', price: 89, description: 'Gaming mouse' },
  { name: 'HyperX Alloy Origins', sku: 'HX-AO', price: 129, description: 'Mechanical keyboard' },
  { name: 'Sandisk Extreme 2TB', sku: 'SD-EXT-2TB', price: 179, description: 'Portable SSD' },
  { name: 'Crucial P5 Plus 2TB', sku: 'CR-P5P', price: 189, description: 'NVMe SSD' },

  // Networking
  { name: 'Netgear Nighthawk AX5400', sku: 'NG-AX5400', price: 399, description: 'WiFi 6 router' },
  { name: 'Mi Power Bank 3 Pro', sku: 'MI-PB3P', price: 49, description: 'Fast charging power bank' },
];

// Warehouse data
const WAREHOUSES = [
    { name: "Main Warehouse", address: "123 Business Park, San Francisco, CA 94102" },
    { name: "East Coast Hub", address: "456 Commerce Drive, New York, NY 10001" },
    { name: "Midwest Distribution", address: "789 Industrial Blvd, Chicago, IL 60601" },
];

const CUSTOMERS = [
  { name: 'Arjun Menon', email: 'arjun.menon@gmail.com', phone: '+91-9000000001' },
  { name: 'Meera Nair', email: 'meera.nair@gmail.com', phone: '+91-9000000002' },
  { name: 'Rahul Das', email: 'rahul.das@gmail.com', phone: '+91-9000000003' },
  { name: 'Sneha Iyer', email: 'sneha.iyer@gmail.com', phone: '+91-9000000004' },
  { name: 'Kiran Kumar', email: 'kiran@gmail.com', phone: '+91-9000000005' },
  { name: 'Fatima Ali', email: 'fatima@gmail.com', phone: '+91-9000000006' },
  { name: 'Vikram Singh', email: 'vikram@gmail.com', phone: '+91-9000000007' },
  { name: 'Ananya Reddy', email: 'ananya@gmail.com', phone: '+91-9000000008' },
  { name: 'Rohit Verma', email: 'rohit@gmail.com', phone: '+91-9000000009' },
  { name: 'Neha Kapoor', email: 'neha@gmail.com', phone: '+91-9000000010' },
];

const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack: number): Date {
    const now = new Date();
    const past = new Date(now.getTime() - randomInt(1, daysBack) * 24 * 60 * 60 * 1000);
    return past;
}

function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
    console.log("🌱 Starting seed for org_id: 37, user_id: 6...\n");

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { user_id: USER_ID } });
    if (!user) {
        console.log("❌ User with id 6 doesn't exist. Creating...");
        await prisma.user.create({
            data: {
                user_id: USER_ID,
                clerk_id: `seed_user_${USER_ID}`,
                email: `seeduser${USER_ID}@example.com`,
            },
        });
        console.log("✅ User created\n");
    }

    // Check if organization exists
    let org = await prisma.organization.findUnique({ where: { org_id: ORG_ID } });
    if (!org) {
        console.log("❌ Organization 37 doesn't exist. Creating...");
        org = await prisma.organization.create({
            data: {
                org_id: ORG_ID,
                name: "Viona Demo Store",
                created_by: USER_ID,
            },
        });
        console.log("✅ Organization created\n");
    }

    // Create warehouses
    console.log("📦 Creating warehouses...");
    const warehouseRecords = [];
    for (const wh of WAREHOUSES) {
        const existing = await prisma.warehouse.findFirst({
            where: { org_id: ORG_ID, name: wh.name },
        });
        if (!existing) {
            const record = await prisma.warehouse.create({
                data: { ...wh, org_id: ORG_ID },
            });
            warehouseRecords.push(record);
            console.log(`  ✅ Created: ${wh.name}`);
        } else {
            warehouseRecords.push(existing);
            console.log(`  ⏭️  Exists: ${wh.name}`);
        }
    }

    // Create products
    console.log("\n🛍️  Creating products...");
    const productRecords = [];
    for (const prod of PRODUCTS) {
        const existing = await prisma.product.findFirst({
            where: { org_id: ORG_ID, sku: prod.sku },
        });
        let currentProduct;
        if (!existing) {
            currentProduct = await prisma.product.create({
                data: {
                    name: prod.name,
                    sku: prod.sku,
                    description: prod.description,
                    org_id: ORG_ID,
                    created_by: USER_ID,
                    status: "active",
                },
            });
            console.log(`  ✅ Created: ${prod.name}`);
        } else {
            currentProduct = existing;
            console.log(`  ⏭️  Exists: ${prod.name}`);
        }
        productRecords.push(currentProduct);

        // Check if historical prices exist for this product
        const pricesCount = await prisma.productPrice.count({
            where: { product_id: currentProduct.product_id }
        });

        if (pricesCount < 4) {
            console.log(`     -> Injecting historical prices for ${prod.name}`);
            const baseDate = new Date();
            const pricePoints = [
                { price: Math.round(prod.price * 0.8), daysAgo: 90 },
                { price: Math.round(prod.price * 0.9), daysAgo: 60 },
                { price: Math.round(prod.price * 0.95), daysAgo: 30 },
                { price: prod.price, daysAgo: 0 }
            ];

            for (let i = 0; i < pricePoints.length; i++) {
                const pt = pricePoints[i];
                const validFrom = new Date(baseDate);
                validFrom.setDate(validFrom.getDate() - pt.daysAgo);

                let validTo = null;
                if (i < pricePoints.length - 1) {
                    validTo = new Date(baseDate);
                    validTo.setDate(validTo.getDate() - pricePoints[i + 1].daysAgo);
                }

                await prisma.productPrice.create({
                    data: {
                        product_id: currentProduct.product_id,
                        actual_price: pt.price,
                        retail_price: pt.price * 1.2,
                        market_price: pt.price * 1.1,
                        valid_from: validFrom,
                        valid_to: validTo
                    },
                });
            }
        }
    }

    // Create product stocks (randomly distribute across warehouses)
    console.log("\n📊 Creating stock levels...");
    for (const product of productRecords) {
        for (const warehouse of warehouseRecords) {
            const existing = await prisma.productStock.findFirst({
                where: {
                    product_id: product.product_id,
                    warehouse_id: warehouse.warehouse_id,
                },
            });

            if (!existing) {
                const qty = randomInt(5, 150);
                await prisma.productStock.create({
                    data: {
                        product_id: product.product_id,
                        warehouse_id: warehouse.warehouse_id,
                        quantity: qty,
                    },
                });
            }
        }
    }
    console.log(`  ✅ Stock created for ${productRecords.length} products across ${warehouseRecords.length} warehouses`);

    // Create orders
    console.log("\n🛒 Creating orders...");
    const ORDER_COUNT = 150;
    let ordersCreated = 0;

    for (let i = 0; i < ORDER_COUNT; i++) {
        const customer = randomElement(CUSTOMERS);
        const status = randomElement(ORDER_STATUSES);
        const orderDate = randomDate(90); // Last 90 days

        // Random items (1-4 products per order)
        const itemCount = randomInt(1, 4);
        const selectedProducts = [...productRecords]
            .sort(() => Math.random() - 0.5)
            .slice(0, itemCount);

        let totalAmount = 0;
        const orderItems = selectedProducts.map(prod => {
            const qty = randomInt(1, 3);
            const price = PRODUCTS.find(p => p.sku === prod.sku)?.price || 99.99;
            totalAmount += price * qty;
            return {
                product_id: prod.product_id,
                quantity: qty,
                price_at_order: price,
            };
        });

        // Create order
        const order = await prisma.order.create({
            data: {
                org_id: ORG_ID,
                placed_by: USER_ID,
                customer_name: customer.name,
                customer_email: customer.email,
                customer_phone: customer.phone,
                status: status,
                order_date: orderDate,
                created_at: orderDate,
                updated_at: orderDate,
                total_amount: totalAmount,
                shipping_street: `${randomInt(100, 9999)} Main Street`,
                shipping_city: randomElement(["San Francisco", "Los Angeles", "New York", "Chicago", "Seattle"]),
                shipping_state: randomElement(["CA", "NY", "IL", "WA", "TX"]),
                shipping_zip: String(randomInt(10000, 99999)),
                shipping_country: "USA",
                payment_method: randomElement(["credit_card", "debit_card", "paypal", "bank_transfer"]),
                shipping_method: randomElement(["standard", "express", "overnight"]),
                notes: Math.random() > 0.7 ? "Please handle with care" : null,
            },
        });

        // Create order items
        for (const item of orderItems) {
            await prisma.orderItem.create({
                data: {
                    order_id: order.order_id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price_at_order: item.price_at_order,
                },
            });
        }

        ordersCreated++;
    }
    console.log(`  ✅ Created ${ordersCreated} orders`);

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("🎉 SEED COMPLETE!");
    console.log("=".repeat(50));
    console.log(`\n📊 Summary for org_id: 37`);
    console.log(`  • Warehouses: ${warehouseRecords.length}`);
    console.log(`  • Products: ${productRecords.length}`);
    console.log(`  • Stock entries: ${productRecords.length * warehouseRecords.length}`);
    console.log(`  • Orders: ${ordersCreated}`);
    console.log(`\n✅ Ready to use with Viona AI!\n`);
}

main()
    .catch((e) => {
        console.error("❌ Error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
