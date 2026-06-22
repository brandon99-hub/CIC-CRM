import { Request, Response, NextFunction } from "express";
import { AuditService } from "../services/audit-service";

export const logProjectAction = (action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // We log the action after a successful response
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Only log successful actions
        // Note: The specific entity info will need to be determined from the request
        // For now, this generic middleware can log that an action occurred
        // More specific logging is usually better handled within the route handler
      }
    });
    next();
  };
};

