-- Migration: add Stacked option to deal_strategy enum

alter type public.deal_strategy add value if not exists 'Stacked';
