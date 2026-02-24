import jwtDecode from "jwt-decode";

export const isTokenExpired = (token: string) => {
  const decoded: any = jwtDecode(token);
  return decoded.exp * 1000 < Date.now();
};
