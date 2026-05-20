'use client'

import { usePathname } from 'next/navigation'

/* ── Mapeamento rota → número/nome ─────────────────────────── */
const ROUTE_MAP: { pattern: RegExp; label: string }[] = [
  { pattern: /^\/cadastro$/,                    label: '01 · Cadastro'        },
  { pattern: /^\/login$/,                       label: '02 · Login'           },
  { pattern: /^\/onboarding$/,                  label: '03 · Onboarding'      },
  { pattern: /^\/feed$/,                        label: '04 · Feed'            },
  { pattern: /^\/$$/,                           label: '04 · Feed'            },
  { pattern: /^\/criar-post$/,                  label: '05 · Criar Post'      },
  { pattern: /^\/novo-post$/,                   label: '05 · Criar Post'      },
  { pattern: /^\/post\/[^/]+$/,                 label: '06 · Post Completo'   },
  { pattern: /^\/bico\/[^/]+$/,                 label: '06 · Post Completo'   },
  { pattern: /^\/enviar-proposta\/[^/]+$/,      label: '07 · Enviar Proposta' },
  { pattern: /^\/propostas\/[^/]+$/,            label: '08 · Propostas'       },
  { pattern: /^\/chat\/[^/]+$/,                 label: '09 · Chat'            },
  { pattern: /^\/conversas$/,                   label: '09 · Chat'            },
  { pattern: /^\/contrato\/[^/]+$/,             label: '10 · Contrato'        },
  { pattern: /^\/contratos$/,                   label: '10 · Contrato'        },
  { pattern: /^\/pato-pay\/[^/]+$/,             label: '11 · Pato Pay'        },
  { pattern: /^\/perfil\/editar$/,              label: '12 · Editar Perfil'   },
  { pattern: /^\/perfil\/[^/]+$/,               label: '12 · Perfil'          },
  { pattern: /^\/perfil$/,                      label: '12 · Perfil'          },
  { pattern: /^\/usuario\/[^/]+$/,              label: '12 · Perfil'          },
  { pattern: /^\/meus-bicos$/,                  label: '13 · Meus Bicos'      },
  { pattern: /^\/meus-interesses$/,             label: '14 · Meus Interesses' },
  { pattern: /^\/notificacoes$/,                label: '15 · Notificações'    },
  { pattern: /^\/busca$/,                       label: '16 · Busca'           },
  { pattern: /^\/buscar$/,                      label: '16 · Busca'           },
  { pattern: /^\/mapa$/,                        label: '17 · Mapa'            },
  { pattern: /^\/salvos$/,                      label: '·· Salvos'            },
  { pattern: /^\/explorar$/,                    label: '·· Explorar'          },
]

function getLabel(path: string): string {
  for (const { pattern, label } of ROUTE_MAP) {
    if (pattern.test(path)) return label
  }
  // Fallback: mostra a rota em formato legível
  const parts = path.split('/').filter(Boolean)
  const name = parts[0]
    ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1).replace(/-/g, ' ')
    : 'Home'
  return `?? · ${name}`
}

export default function PageBadge() {
  const pathname = usePathname()
  const label = getLabel(pathname)

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 99999,
        background: '#FFD11A',
        color: '#0F0F0F',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 6,
        padding: '4px 8px',
        opacity: 0.85,
        letterSpacing: '0.02em',
        pointerEvents: 'none',
        userSelect: 'none',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  )
}
