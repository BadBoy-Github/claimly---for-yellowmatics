import { ErrorPage } from '../../src/components/claims/Dashboard.jsx';

export default async function ForbiddenPage({ searchParams }) {
  const params = await searchParams;
  return <ErrorPage forbidden reason={params?.reason} />;
}
