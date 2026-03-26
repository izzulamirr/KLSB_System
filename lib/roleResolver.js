export async function resolveUserRole(admin, decodedToken) {
  const defaultRole = process.env.DEFAULT_USER_ROLE || "staff";
  const bdRoleName = (process.env.BD_ROLE_NAME || "bd").toLowerCase();
  const sysdevRoleName = (process.env.SYSDEV_ROLE_NAME || "sysdev").toLowerCase();
  const hrRoleName = (process.env.HR_ROLE_NAME || "hr").toLowerCase();

  const bdEmails = String(process.env.BD_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const sysdevEmails = String(process.env.SYSDEV_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const hrEmails = String(process.env.HR_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const userEmail = String(decodedToken?.email || "").toLowerCase();
  const tokenName = String(decodedToken?.name || decodedToken?.displayName || "").toLowerCase();

  const userLocalPart = userEmail.includes("@") ? userEmail.split("@")[0] : userEmail;

  // Explicit mapping for known users requested by operations.
  // This is intentionally checked first so operational mapping wins over stale claims/docs.
  if (userEmail === "test@gmail.com" || userLocalPart === "tester") {
    return hrRoleName;
  }

  if (userLocalPart === "sysdev") {
    return sysdevRoleName;
  }

  if (tokenName.includes("sysdev")) {
    return sysdevRoleName;
  }

  if (userEmail === "admin@klsb.com") {
    return sysdevRoleName;
  }

  if (userEmail && sysdevEmails.includes(userEmail)) {
    return sysdevRoleName;
  }

  if (userEmail && hrEmails.includes(userEmail)) {
    return hrRoleName;
  }

  if (userEmail && bdEmails.includes(userEmail)) {
    return bdRoleName;
  }

  const claimRole = String(decodedToken?.role || decodedToken?.claims?.role || "").toLowerCase();
  if (claimRole) return claimRole;

  const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
  const roleDoc = await admin.firestore().collection(roleCollection).doc(decodedToken.uid).get();
  if (roleDoc.exists) {
    const docRole = String(roleDoc.data()?.role || "").toLowerCase();
    if (docRole) return docRole;
  }

  return defaultRole.toLowerCase();
}

export function isBdRole(role) {
  const bdRoleName = (process.env.BD_ROLE_NAME || "bd").toLowerCase();
  return String(role || "").toLowerCase() === bdRoleName;
}

export function isSysdevRole(role) {
  const sysdevRoleName = (process.env.SYSDEV_ROLE_NAME || "sysdev").toLowerCase();
  return String(role || "").toLowerCase() === sysdevRoleName;
}
