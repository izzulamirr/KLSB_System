import BDEditProposalPage from "../../../../../components/bd/BDEditProposalPage";

export default function BdEditProposalRoute({ params, searchParams }) {
  const queryString = new URLSearchParams(
    Object.entries(searchParams || {}).flatMap(([key, value]) => {
      if (Array.isArray(value)) return value.map((item) => [key, String(item)]);
      return [[key, String(value)]];
    })
  ).toString();

  return <BDEditProposalPage proposalId={params.id} queryString={queryString} returnTo={searchParams?.returnTo} />;
}
