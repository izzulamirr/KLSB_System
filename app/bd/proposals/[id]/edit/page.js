import BDEditProposalPage from "../../../../../components/bd/BDEditProposalPage";

export default function BdEditProposalRoute({ params }) {
  return <BDEditProposalPage proposalId={params.id} />;
}
