# shared/ — data used by both backend and frontend

## kenya-admin-units.json

County → sub-county → ward lists for the "where found / where lost" fields.

| Level | Count | Source |
|---|---|---|
| Counties | 47 | IEBC (2010 Constitution) |
| Sub-counties | 301 | KNBS administrative sub-county listing |
| Wards | 1,450 | IEBC 2013 ward list (County Assembly wards) |

Taken from the npm package `kenya-regions` 2.2.0 (MIT licence, see `LICENSE-kenya-regions`), which cites the IEBC
hierarchy and the KNBS sub-county listing. Format: `{ "counties": [ { "county", "sub_counties": [ { "name", "wards": [...] } ] } ] }`.

Changes made when building this file:

- Names tidied: `Manyatta 'b'` → `Manyatta B`, `Nyalenda 'a'` → `Nyalenda A`, `Dandora Area Ii` → `Dandora Area II` (and III, IV, Umoja II), `Iria-Ini` → `Iria-ini`, `Mugumo-Ini` → `Mugumo-ini`.
- 12 wards that the package could not place under a sub-county (spelling mismatch between its two sources) were placed
  under the sub-county that contains the rest of their constituency: Bura (Tana River), Ndithini → Masinga, Muthwani → Athi River,
  Machakos Central → Machakos, Kalawa → Mbooni, Iria-ini → Nyeri South, Township → Thika Town, Township → Kiambu Town,
  Kinamba → Laikipia West, Maiella → Naivasha, Biashara → Nakuru East, Kitutu Central → Kitutu Chache South.

Known limit: 27 further sub-counties were gazetted in November 2024 (341 total). They are not in this list yet; if you need one,
add it to this file (both backend and frontend read it) and restart the backend.
