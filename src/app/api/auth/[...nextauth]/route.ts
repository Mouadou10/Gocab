/**
 * NextAuth v5 API Route Handler
 * Handles all auth endpoints: GET/POST /api/auth/[...nextauth]
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
