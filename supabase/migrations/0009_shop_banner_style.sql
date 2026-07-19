-- Lets a shop owner choose how the app header banner renders: their uploaded
-- logo image, or the shop name typeset by the app (for logos that don't fit
-- a short wide banner well, e.g. square or tall marks).
alter table shops add column banner_style text not null default 'logo'
  check (banner_style in ('logo', 'typeset'));
