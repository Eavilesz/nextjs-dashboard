'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // Converting to cents to avoid JS floating point errors
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0]; // Formatting the date in YYYY-MM-DD format

  try {
    // Use Prisma's create method to insert data
    await prisma.invoices.create({
      data: {
        customer_id: customerId,
        amount: amountInCents,
        status: status,
        date: new Date(date), // Using Prisma's Date type handling
      },
    });
  } catch (error) {
    console.error('Database Error:', error);
    return {
      message: 'Database Error: Failed to create invoice.',
    };
  }

  // Invalidate cache and redirect
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData
) {
  // Validate form data with your schema
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to update invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;

  // Convert amount to cents to avoid JS floating-point errors
  const amountInCents = amount * 100;

  try {
    // Use Prisma's update method to update the invoice
    await prisma.invoices.update({
      where: { id: id },
      data: {
        customer_id: customerId,
        amount: amountInCents,
        status: status,
      },
    });
  } catch (error) {
    console.error('Database Error:', error);
    return {
      message: 'Database error: Failed to update invoice.',
    };
  }

  // Revalidate and redirect
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    // Use Prisma's delete method to remove the invoice
    await prisma.invoices.delete({
      where: { id: id },
    });

    // Revalidate and notify after deletion
    revalidatePath('/dashboard/invoices');
    return { message: 'Invoice deleted successfully.' };
  } catch (error) {
    console.error('Database Error:', error);
    return {
      message: 'Database Error: Failed to delete invoice.',
    };
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
