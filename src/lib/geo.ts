/** Structured address resolved from the autocomplete + details flow.
 *  Only `city`/`state`/`country` are ever shown publicly; the full address
 *  (street, CEP, coords) stays private and is used only for matching. */
export interface LocationData {
  city:      string
  state:     string   // UF (short, e.g. "SP")
  country:   string   // e.g. "BR"
  cep:       string
  lat:       number | null
  lng:       number | null
  formatted: string   // full display string (private)
}
