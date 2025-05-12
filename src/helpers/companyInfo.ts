import { Document, Types } from "mongoose";
import CompanyInfo from "../models/companyInfo";

export const companyInfoHelper = {
  getCompanyInfo: async (
    title: string,
    slug: string
  ): Promise<string | null> => {
    try {
      const companyInfo = await CompanyInfo.findOne({ title, slug }).lean();
      return companyInfo ? companyInfo.value || null : null;
    } catch (error) {
      console.error("Error fetching company info:", error);
      throw new Error("Failed to fetch company info");
    }
  },

  getCompanyInfoValues: async (
    criteria: { title: string; slug: string }[]
  ): Promise<(string | null)[]> => {
    try {
      const companyInfo = await CompanyInfo.find({
        $or: criteria.map(({ title, slug }) => ({ title, slug })),
      }).lean();

      return criteria.map(({ title, slug }) => {
        const match = companyInfo.find(
          (data) => data.title === title && data.slug === slug
        );
        return match ? match.value || null : null;
      });
    } catch (error) {
      console.error("Error fetching company info values:", error);
      throw new Error("Failed to fetch company info values");
    }
  },

  getCompanyCurrency: async (): Promise<string | null> => {
    return companyInfoHelper.getCompanyInfo("Company", "currency");
  },

  getCompanyName: async (): Promise<string | null> => {
    return companyInfoHelper.getCompanyInfo("Company", "name");
  },

  getCompanyFavicon: async (): Promise<string | null> => {
    return companyInfoHelper.getCompanyInfo("Company", "favicon");
  },

  getCompanyLogo: async (): Promise<string | null> => {
    return companyInfoHelper.getCompanyInfo("Company", "logo");
  },

  getCompanyBscAddress: async (): Promise<string | null> => {
    return companyInfoHelper.getCompanyInfo("Company", "bsc_address");
  },
};
