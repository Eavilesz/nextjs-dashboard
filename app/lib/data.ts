import { formatCurrency } from './utils';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function fetchRevenue() {
  try {
    const revenueData = await prisma.revenue.findMany();

    return revenueData;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const latestInvoices = await prisma.invoices.findMany({
      select: {
        amount: true,
        id: true,
        customer: {
          select: {
            name: true,
            image_url: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: 5,
    });

    return latestInvoices.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    // Use Promise.all to run queries in parallel
    const invoiceCountPromise = prisma.invoices.count(); // Count total invoices
    const customerCountPromise = prisma.customers.count(); // Count total customers
    const invoiceStatusPromise = prisma.invoices.aggregate({
      _sum: {
        amount: true, // Total amount
      },
      where: {
        status: {
          in: ['paid', 'pending'], // Filter for paid and pending statuses
        },
      },
    });

    // Wait for all promises to resolve
    const [numberOfInvoices, numberOfCustomers, invoiceStatusData] =
      await Promise.all([
        invoiceCountPromise,
        customerCountPromise,
        invoiceStatusPromise,
      ]);

    // Calculate totals for paid and pending invoices
    const totalPaidInvoices = formatCurrency(
      invoiceStatusData._sum.amount !== null ? invoiceStatusData._sum.amount : 0 // Assuming some logic for 'paid' invoices
    );
    const totalPendingInvoices = formatCurrency(
      invoiceStatusData._sum.amount !== null ? invoiceStatusData._sum.amount : 0 // Assuming some logic for 'pending' invoices
    );

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  // Validate date from the query string
  const parsedDate = new Date(query);
  const isValidDate = !isNaN(parsedDate.getTime());

  // Validate if the query can be a valid number
  const parsedNumber = Number(query);
  const isValidNumber = !isNaN(parsedNumber);

  try {
    const invoices = await prisma.invoices.findMany({
      select: {
        id: true,
        amount: true,
        date: true,
        status: true,
        customer: {
          select: {
            name: true,
            email: true,
            image_url: true,
          },
        },
      },
      where: {
        OR: [
          {
            customer: {
              name: {
                contains: query,
                mode: 'insensitive', // Case insensitive search
              },
            },
          },
          {
            customer: {
              email: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
          ...(isValidNumber
            ? [
                {
                  amount: {
                    gte: parsedNumber, // Apply the number filter only if valid
                  },
                },
              ]
            : []),
          ...(isValidDate
            ? [
                {
                  date: {
                    gte: parsedDate, // Apply the date filter only if valid
                  },
                },
              ]
            : []),
          {
            status: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      orderBy: {
        date: 'desc',
      },
      skip: offset, // Apply pagination offset
      take: ITEMS_PER_PAGE, // Limit to ITEMS_PER_PAGE
    });

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const count = await prisma.invoices.count({
      where: {
        OR: [
          {
            customer: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            },
          },
          {
            amount: {
              gte: isNaN(parseFloat(query))
                ? undefined
                : parseFloat(query) * 100,
              lte: isNaN(parseFloat(query))
                ? undefined
                : parseFloat(query) * 100,
            },
          },
          {
            date: {
              gte: isNaN(Date.parse(query)) ? undefined : new Date(query),
              lte: isNaN(Date.parse(query)) ? undefined : new Date(query),
            },
          },
          { status: { contains: query, mode: 'insensitive' } },
        ],
      },
    });

    const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const invoice = await prisma.invoices.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        customer_id: true,
        amount: true,
        status: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice with id ${id} not found`);
    }

    const validStatus = (status: string): 'pending' | 'paid' => {
      if (status === 'pending' || status === 'paid') {
        return status;
      }
      throw new Error(`Invalid status: ${status}`);
    };

    // Convert amount from cents to dollars
    return {
      ...invoice,
      amount: invoice.amount / 100,
      status: validStatus(invoice.status), // Ensure status matches the type
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const customers = await prisma.customers.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc', // Order by name in ascending order
      },
    });

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const customers = await prisma.customers.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive', // Case-insensitive search for name
            },
          },
          {
            email: {
              contains: query,
              mode: 'insensitive', // Case-insensitive search for email
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        image_url: true,
        invoices: {
          select: {
            id: true,
            status: true,
            amount: true,
          },
        },
      },
      orderBy: {
        name: 'asc', // Order by name in ascending order
      },
    });

    // Aggregate the invoice data and format currency
    const formattedCustomers = customers.map((customer) => {
      const total_invoices = customer.invoices.length;

      const total_pending = customer.invoices
        .filter((invoice) => invoice.status === 'pending')
        .reduce((acc, invoice) => acc + invoice.amount, 0);

      const total_paid = customer.invoices
        .filter((invoice) => invoice.status === 'paid')
        .reduce((acc, invoice) => acc + invoice.amount, 0);

      return {
        ...customer,
        total_invoices,
        total_pending: formatCurrency(total_pending), // Format pending amount
        total_paid: formatCurrency(total_paid), // Format paid amount
      };
    });

    return formattedCustomers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
