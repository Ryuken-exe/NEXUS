import { Gallery } from '@/components/gallery';
import { SiteHeader } from '@/components/site-header';
export default function EventPage({ params }: { params: { slug: string } }) { return <><SiteHeader /><Gallery slug={params.slug} /></>; }