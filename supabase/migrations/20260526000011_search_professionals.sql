-- FUNÇÃO: busca de profissionais por raio com expansão automática
create or replace function search_professionals(
  search_query text,
  lat float,
  lng float,
  radius_km float default 50,
  max_radius_km float default 500
)
returns table (
  user_id uuid,
  username text,
  headline text,
  avg_rating numeric,
  total_jobs_completed integer,
  distance_km float,
  location_city text
) as $$
declare
  current_radius float := radius_km;
  result_count integer := 0;
begin
  loop
    return query
      select
        u.id,
        u.username,
        pp.headline,
        pp.avg_rating,
        pp.total_jobs_completed,
        round((st_distance(
          pp.location_point,
          st_makepoint(lng, lat)::geography
        ) / 1000)::numeric, 1)::float,
        pp.location_city
      from professional_profiles pp
      join users u on u.id = pp.user_id
      where
        pp.is_available = true
        and u.is_active = true
        and u.is_suspended = false
        and st_dwithin(
          pp.location_point,
          st_makepoint(lng, lat)::geography,
          current_radius * 1000
        )
        and (
          search_query = ''
          or pp.skills && array[search_query]
          or pp.headline ilike '%' || search_query || '%'
          or to_tsvector('portuguese', coalesce(pp.headline, '')) @@ plainto_tsquery('portuguese', search_query)
        )
      order by
        pp.avg_rating desc,
        st_distance(pp.location_point, st_makepoint(lng, lat)::geography) asc;

    get diagnostics result_count = row_count;
    exit when result_count > 0 or current_radius >= max_radius_km;
    current_radius := least(current_radius * 2, max_radius_km);
  end loop;
end;
$$ language plpgsql;
