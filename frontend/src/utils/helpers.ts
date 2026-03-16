export const safeArray = <T>(val: any): T[] => {
  if (Array.isArray(val)) return val;
  if (Array.isArray(val?.data)) return val.data;
  if (Array.isArray(val?.items)) return val.items;
  if (Array.isArray(val?.results)) return val.results;
  if (Array.isArray(val?.records)) return val.records;
  return [];
};
