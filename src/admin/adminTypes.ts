import { Timestamp } from 'firebase/firestore';

export interface PageActionPermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  print: boolean;
  export: boolean;
}

export type PermissionMatrix = Record<string, PageActionPermission>;

export interface RoleModel {
  id: string;
  roleName: string;
  roleCode: string;
  description: string;
  status: 'active' | 'inactive';
  businessId: string;
  permissions: PermissionMatrix;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface UserAccountModel {
  id: string; // uid or doc id
  uid: string;
  employeeId?: string;
  employeeName?: string;
  username: string;
  email: string;
  mobile?: string;
  departmentId?: string;
  departmentName?: string;
  designationId?: string;
  designationName?: string;
  roleId: string;
  roleName: string;
  status: 'active' | 'inactive';
  lastLogin?: Timestamp | string;
  createdAt?: Timestamp | string;
  customPermissions?: PermissionMatrix;
  businessId: string;
}

export interface ApprovalLevelConfig {
  level: number;
  approverType: 'user' | 'role';
  approverId: string; // user uid or role name/id
  approverUid?: string;
  approverEmail?: string;
  approverRole?: string;
  approverName: string;
  amountLimit?: number;
}

export interface ApprovalRuleModel {
  id: string;
  pageId: string; // e.g. 'purchases' or 'purchase-requisition'
  pageName: string;
  module: string;
  approvalRequired: boolean;
  approvalType: 'user' | 'role';
  approverId?: string;
  approverUid?: string;
  approverEmail?: string;
  approverRole?: string;
  approverName?: string;
  status: 'active' | 'inactive';
  levels: ApprovalLevelConfig[];
  businessId: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface ApprovalHistoryEntry {
  id: string;
  level: number;
  approverUid: string;
  approverName: string;
  approverRole?: string;
  action: 'submit' | 'approve' | 'reject' | 'send_back';
  comment?: string;
  previousStatus: string;
  newStatus: string;
  timestamp: Timestamp | string;
}

export interface EmployeeModel {
  id: string;
  employeeIdCode: string;
  employeeName: string;
  photoUrl?: string;
  departmentId?: string;
  departmentName?: string;
  designationId?: string;
  designationName?: string;
  joiningDate?: string;
  employmentType: 'Full-time' | 'Part-time' | 'Contract' | 'Intern';
  mobile?: string;
  email?: string;
  address?: string;
  status: 'active' | 'inactive';
  businessId: string;
  createdAt?: Timestamp | string;
}

export interface DesignationModel {
  id: string;
  designationCode: string;
  designationName: string;
  departmentId?: string;
  departmentName?: string;
  description?: string;
  status: 'active' | 'inactive';
  businessId: string;
  createdAt?: Timestamp | string;
}

export interface DepartmentModel {
  id: string;
  departmentCode: string;
  departmentName: string;
  departmentHeadId?: string;
  departmentHeadName?: string;
  description?: string;
  status: 'active' | 'inactive';
  businessId: string;
  createdAt?: Timestamp | string;
}

export interface AuditLogModel {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  timestamp: Timestamp | string;
  module: string;
  page: string;
  action: 'Login' | 'Logout' | 'Create' | 'Edit' | 'Delete' | 'Approve' | 'Reject' | 'Permission Change' | 'Role Change';
  recordId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  device?: string;
  businessId: string;
}

export interface SystemSettingsModel {
  id: string;
  businessId: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  taxId?: string;
  currencySymbol: string;
  requirePasswordComplexity: boolean;
  sessionTimeoutMinutes: number;
  defaultRoleId: string;
  allowSelfRegistration: boolean;
  updatedAt?: Timestamp | string;
}
