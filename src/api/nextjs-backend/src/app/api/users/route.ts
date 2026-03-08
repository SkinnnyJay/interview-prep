import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { User } from "@/types";
import { HttpStatus } from "@/constants";

// In-memory storage for demo
const users: User[] = [];

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    data: users,
    total: users.length,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validatedData = createUserSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: validatedData.error.errors,
        },
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    const { email, name } = validatedData.data;
    const now = new Date();
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name,
      createdAt: now,
      updatedAt: now,
    };

    users.push(newUser);

    return NextResponse.json(
      {
        success: true,
        data: newUser,
      },
      { status: HttpStatus.CREATED }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body",
        },
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: HttpStatus.INTERNAL_SERVER_ERROR }
    );
  }
}
