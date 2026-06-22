import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { marketingUsers } from "../../shared/schema";
import { eq, and, or } from "drizzle-orm";
import jwt from "jsonwebtoken";

// Extend Request interface to include marketing user
declare global {
  namespace Express {
    interface Request {
      marketingUser?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        permissions?: string[];
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "[FATAL] JWT_SECRET environment variable is not set. " +
    "The server cannot start without a cryptographic secret."
  );
}

export interface MarketingJWTPayload {
  userId: string;
  email: string;
  role: string;
}

// Marketing Authentication Middleware
export const marketingAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      // Allow internal/programmatic callers that might use Bearer tokens
      const origin = req.headers.origin;
      const isAllowedProgrammaticCaller = !origin || origin === process.env.INTERNAL_SERVICE_ORIGIN;
      if (isAllowedProgrammaticCaller) {
        const bearerToken = req.header('Authorization')?.replace('Bearer ', '');
        if (bearerToken) {
          try {
            const decoded = jwt.verify(bearerToken, JWT_SECRET) as MarketingJWTPayload;
            // Get user from database...
            const user = await db.select().from(marketingUsers).where(eq(marketingUsers.id, decoded.userId)).limit(1);
            if (user.length > 0 && user[0].isActive) {
               req.marketingUser = { id: user[0].id, email: user[0].email, firstName: user[0].firstName, lastName: user[0].lastName, role: user[0].role };
               return next();
            }
          } catch (err) {
             return res.status(401).json({ error: 'Invalid bearer token.' });
          }
        }
      }
      return res.status(401).json({ error: 'Access denied. No valid cookie or token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as MarketingJWTPayload;

    // Get user from database
    const user = await db
      .select()
      .from(marketingUsers)
      .where(eq(marketingUsers.id, decoded.userId))
      .limit(1);

    if (user.length === 0 || !user[0].isActive) {
      return res.status(401).json({ error: 'Invalid token or user not found.' });
    }

    // Fetch user permissions
    const { userRoles, systemRolePermissions, systemPermissions } = await import("../../shared/adminSchema");
    const permissions = await db
      .select({ key: systemPermissions.key })
      .from(systemPermissions)
      .innerJoin(systemRolePermissions, eq(systemRolePermissions.permissionId, systemPermissions.id))
      .innerJoin(userRoles, eq(userRoles.roleId, systemRolePermissions.roleId))
      .where(
        and(
          eq(userRoles.userId, user[0].id),
          eq(systemPermissions.isActive, true)
        )
      );

    req.marketingUser = {
      id: user[0].id,
      email: user[0].email,
      firstName: user[0].firstName,
      lastName: user[0].lastName,
      role: user[0].role,
      permissions: permissions.map(p => p.key),
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// Marketing Admin Authorization Middleware (Dynamic check via database roles)
export const marketingAdminAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.marketingUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Admin panel access is strictly governed by the "admin.view" permission only.
    // "marketing.view_all" grants visibility into marketing pipeline data, NOT admin config.
    const hasAdminView = req.marketingUser.permissions?.includes("admin.view");

    if (!hasAdminView) {
      return res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
    }

    next();
  } catch (error) {
    console.error("Error in marketingAdminAuth middleware:", error);
    res.status(500).json({ error: "Internal server error during authorization" });
  }
};

// Marketing User Authorization Middleware (Internal logic or own data)
export const marketingUserAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.marketingUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    // Check for "marketing.view_all" or "admin.view" permissions as bypass
    const hasGlobalView = req.marketingUser.permissions?.some(p =>
      ["marketing.view_all", "admin.view"].includes(p)
    );

    if (hasGlobalView) {
      return next();
    }

    // Check for "marketing.view_assigned" permission
    const hasAssignedView = req.marketingUser.permissions?.includes("marketing.view_assigned");

    if (!hasAssignedView) {
      return res.status(403).json({ 
        error: 'Access denied.', 
        message: 'You do not have permission to view marketing data.' 
      });
    }

    // Marketer can only access their own data
    const requestedMarketerId = req.params.marketerId || req.body.marketerId || req.query.marketerId;
    if (requestedMarketerId && requestedMarketerId !== req.marketingUser.id) {
      return res.status(403).json({ error: 'Access denied. You can only access your own data.' });
    }

    next();
  } catch (error) {
    console.error("Error in marketingUserAuth middleware:", error);
    res.status(500).json({ error: "Internal server error during authorization" });
  }
};

// Generate JWT Token
export const generateMarketingToken = (user: {
  id: string;
  email: string;
  role: string;
}): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Hash Password
export const hashMarketingPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Verify Password
export const verifyMarketingPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

// Marketing Permission Check Middleware
export const checkPermission = (permissionKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.marketingUser) {
        return res.status(401).json({ error: 'Authentication required.' });
      }

      // Check if any of the user's roles have the required permission
      const userHasPermission = req.marketingUser.permissions?.includes(permissionKey);

      if (!userHasPermission) {
        // Log the denied attempt
        console.warn(`Permission denied: User ${req.marketingUser.id} attempted to access ${permissionKey}`);
        return res.status(403).json({
          error: 'Access denied.',
          message: `You do not have the required permission: ${permissionKey}`
        });
      }

      next();
    } catch (error) {
      console.error("Error in checkPermission middleware:", error);
      res.status(500).json({ error: "Internal server error during permission check" });
    }
  };
};
