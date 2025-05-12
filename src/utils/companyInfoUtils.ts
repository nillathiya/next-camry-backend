// utils/companyInfoUtils.ts
import CompanyInfo from "../models/companyInfo";

export const getCompanyInfoValue = async (
  title: string,
  slug: string
): Promise<string | undefined> => {
  const setting = await CompanyInfo.findOne({ title, slug }).lean();
  return setting?.value;
};

export const getCompanyInfoValues = async (
  criteria: { title: string; slug: string }[]
): Promise<(string | undefined)[]> => {
  // Fetch all matching documents in one query using $or
  const queries = criteria.map(({ title, slug }) => ({ title, slug }));
  const settings = await CompanyInfo.find({ $or: queries }).lean();

  // Map criteria to their corresponding values
  return criteria.map(({ title, slug }) => {
    const setting = settings.find((s) => s.title === title && s.slug === slug);
    return setting?.value;
  });
};

export const getCompanyCurrency = async (): Promise<string | undefined> => {
  return getCompanyInfoValue("Company", "currency");
};

export const getCompanyName = async (): Promise<string | undefined> => {
  return getCompanyInfoValue("Company", "name");
};

export const getCompanyFavicon = async (): Promise<string | undefined> => {
  return getCompanyInfoValue("Company", "favicon");
};

export const getCompanyLogo = async (): Promise<string | undefined> => {
  return getCompanyInfoValue("Company", "logo");
};

export const getCompanyCopyright = async (): Promise<string | undefined> => {
  return getCompanyInfoValue("Company", "copyright");
};

export const getCompanyBscAddress = async (): Promise<string | undefined> => {
  return getCompanyInfoValue("Company", "bsc_address");
};

export const getCompanyTokenContract = async (): Promise<
  string | undefined
> => {
  return getCompanyInfoValue("Company", "token_contract");
};
