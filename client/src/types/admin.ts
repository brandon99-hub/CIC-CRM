export interface Role {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    dashboards: string[];
    createdAt: string;
}

export interface Permission {
    id: string;
    key: string;
    description: string | null;
    module: string;
    isActive: boolean;
}

export interface RolePermission {
    id: string;
    roleId: string;
    permissionId: string;
}

export interface Department {
    id: string;
    name: string;
    code: string;
    description: string | null;
    parentDepartmentId: string | null;
    isActive: boolean;
}

export interface ServiceCategory {
    id: string;
    name: string;
    code: string;
    description: string | null;
    departmentId: string | null;
    defaultPriority: string;
    isActive: boolean;
}

export interface SlaRule {
    id: string;
    name: string;
    serviceCategoryId: string | null;
    priority: string;
    metricType: string;
    timeline: number;
    timelineUnit: string;
    responseTimeMinutes: number | null;
    businessHoursOnly: boolean;
    businessHoursStart: string;
    businessHoursEnd: string;
    isActive: boolean;
}

export interface EscalationChain {
    id: string;
    name: string;
    serviceCategoryId: string | null;
    slaId: string | null;
    priority: string | null;
    description: string | null;
    isActive: boolean;
    steps?: EscalationStep[];
}

export interface EscalationStep {
    id: string;
    chainId: string;
    stepOrder: number;
    assigneeRoleId: string | null;
    assigneeUserId: string | null;
    assigneeDepartmentId: string | null; // Current Department
    targetDepartmentId: string | null;   // New: Department to escalate to
    escalateAfterMinutes: number;
    requiresConsent: boolean;
    gracePeriodMinutes: number;
    notifyChannel: string;
    description: string | null;
}

export interface WorkflowRule {
    id: string;
    name: string;
    description: string | null;
    serviceCategoryId: string | null;
    priority: string | null;
    triggerEvent: string;
    conditions: Record<string, unknown>;
    actions: Record<string, unknown>;
    isActive: boolean;
}

export interface Integration {
    id: string;
    name: string;
    portalType: string;
    baseUrl: string;
    apiKey: string;
    clientId?: string;
    clientSecret?: string;
    authType: string;
    isActive: boolean;
    lastTestStatus?: string | null;
    lastTestAt?: string | null;
    lastSyncedAt?: string | null;
    syncStatus?: string | null;
    syncInterval?: number;
    createdAt?: string;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    userId: string | null;
    userName?: string;
    userEmail?: string;
    action: string;
    module: string;
    entityType?: string | null;
    entityId?: string | null;
    details?: string | Record<string, unknown> | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    ipAddress?: string | null;
    machineInfo?: string | null;
    rawMetadata?: any;
}

export interface SystemUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string | null;
    role: string;
    departmentId?: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
    dashboardAccess: string;
    createdAt: string;
}

export interface UserRoleAssignment {
    id: string;
    userId: string;
    roleId: string;
}

export interface UserForm {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    departmentId: string;
    roleIds: string[];
    password?: string;
}
