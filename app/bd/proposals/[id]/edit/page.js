import BDEditProposalPage from "../../../../../components/bd/BDEditProposalPage";

export default async function BdEditProposalRoute({ params, searchParams }) {
  const awaitedParams = await params;
  const awaitedSearchParams = await searchParams;
  const rawReturnTo = awaitedSearchParams?.returnTo;
  const normalizedReturnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : (rawReturnTo || "");

  return <BDEditProposalPage proposalId={awaitedParams.id} returnTo={normalizedReturnTo} />;
}
