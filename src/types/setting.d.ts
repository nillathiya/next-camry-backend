import e from "cors";

export interface IAdminSettingsQuery {
  slug?: string;
  category?: string;
  status?: number;
  adminStatus?: number;
  [key: string]: any;
}

export interface IWebsiteSettingsQuery {
  adminStatus?: number;
  status?: number;
  [key: string]: any; 
}

export interface IWalletSettingsQuery {
  status?: number;
}
