-- Cartridge variants need a resistance (ohms) spec, e.g. 0.4, 0.6, 0.8.
alter table variants add column ohms numeric;
