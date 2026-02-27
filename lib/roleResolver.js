export async function resolveUserRole(admin, decodedToken) {
  const defaultRole = process.env.DEFAULT_USER_ROLE || "staff";
  const bdRoleName = (process.env.BD_ROLE_NAME || "bd").toLowerCase();

  const claimRole = String(decodedToken?.role || decodedToken?.claims?.role || "").toLowerCase();
  if (claimRole) return claimRole;

  const roleCollection = process.env.USER_ROLES_COLLECTION || "user_roles";
  const roleDoc = await admin.firestore().collection(roleCollection).doc(decodedToken.uid).get();
  if (roleDoc.exists) {
    const docRole = String(roleDoc.data()?.role || "").toLowerCase();
    if (docRole) return docRole;
  }

  const bdEmails = String(process.env.BD_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const userEmail = String(decodedToken?.email || "").toLowerCase();
  if (userEmail && bdEmails.includes(userEmail)) {
    return bdRoleName;
  }

  return defaultRole.toLowerCase();
}

export function isBdRole(role) {
  const bdRoleName = (process.env.BD_ROLE_NAME || "bd").toLowerCase();
  return String(role || "").toLowerCase() === bdRoleName;
}
