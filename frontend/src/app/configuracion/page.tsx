import { redirect } from 'next/navigation';

export default function ConfiguracionRedirectPage() {
  redirect('/?section=devices');
}
