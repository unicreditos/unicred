import { ButtonLink, CardHead, PageHead, Pad } from '@/components/uc/blocks'
import { Icon } from '@/components/uc/icons'
import { BRAND } from '@/lib/brand'

export const metadata = { title: 'Contacto' }

export default function ContactoPage() {
  return (
    <>
      <PageHead
        title="Contacto"
        description="Cómo escribirnos. Para un reclamo con seguimiento usá la sección de reclamos."
        actions={<ButtonLink primary href="/dashboard/ayuda">Presentar un reclamo</ButtonLink>}
      />
      <Pad>
        <CardHead title="Canales" />
        <ul className="uc-feed">
          {BRAND.phone ? (
            <li>
              <span className="uc-fi"><Icon name="phone" size="sm" /></span>
              <span className="uc-ft">Teléfono<small className="uc-num">{BRAND.phone}</small></span>
            </li>
          ) : null}
          <li>
            <span className="uc-fi"><Icon name="mail" size="sm" /></span>
            <span className="uc-ft">Email<small>{BRAND.supportEmail}</small></span>
          </li>
          <li>
            <span className="uc-fi"><Icon name="clock" size="sm" /></span>
            <span className="uc-ft">Horario<small>Lunes a viernes de 9 a 18 h</small></span>
          </li>
        </ul>
      </Pad>
    </>
  )
}
