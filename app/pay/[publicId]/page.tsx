import { PublicPayPage } from "./PublicPayPage";

interface PayPageProps {
  params: Promise<{ publicId: string }>;
}

export default async function PayPage({ params }: PayPageProps) {
  const { publicId } = await params;
  return <PublicPayPage publicId={publicId} />;
}
