-- BidZone initial seed data for local development & Docker Compose
-- All users share the password: password123

INSERT INTO users (id, name, email, password_hash) VALUES
  (1, 'Alice Seller', 'alice@bidzone.local', '$2b$10$wT1n0xK/nL3rYg1Q7yZkLe9eXz2mF1mU3lTq6Vp8G0yYyA1B2C3D4'),
  (2, 'Bob Bidder', 'bob@bidzone.local', '$2b$10$wT1n0xK/nL3rYg1Q7yZkLe9eXz2mF1mU3lTq6Vp8G0yYyA1B2C3D4'),
  (3, 'Charlie Bidder', 'charlie@bidzone.local', '$2b$10$wT1n0xK/nL3rYg1Q7yZkLe9eXz2mF1mU3lTq6Vp8G0yYyA1B2C3D4'),
  (4, 'Diana Evaluator', 'demo@bidzone.local', '$2b$10$wT1n0xK/nL3rYg1Q7yZkLe9eXz2mF1mU3lTq6Vp8G0yYyA1B2C3D4')
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

INSERT INTO auctions (id, seller_id, title, description, image_url, starting_price, current_highest_bid, current_highest_bidder_id, min_increment, starts_at, ends_at, status, version) VALUES
  (1, 1, 'Vintage Rolex Submariner 1978', 'Reference 1680 in exceptional unpolished condition with original box and papers.', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80', 500000.00, 520000.00, 2, 10000.00, now() - INTERVAL '2 days', now() + INTERVAL '3 days', 'ACTIVE', 2),
  (2, 1, 'Custom Mechanical Keyboard (Iron165)', 'Feat. Lubed Gateron Oil Kings, POM plate, and GMK Olivia keycaps.', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80', 25000.00, 28000.00, 3, 1000.00, now() - INTERVAL '1 day', now() + INTERVAL '5 days', 'ACTIVE', 3),
  (3, 1, 'NVIDIA GeForce RTX 4090 Founders Edition', 'Brand new in sealed box with manufacturer warranty.', 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=800&q=80', 160000.00, 165000.00, 2, 5000.00, now() - INTERVAL '3 hours', now() + INTERVAL '90 seconds', 'ACTIVE', 1),
  (4, 1, '1st Edition Shadowless Charizard (PSA 9)', 'Mint condition grail collectible card.', 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?auto=format&fit=crop&w=800&q=80', 800000.00, 800000.00, NULL, 20000.00, now() - INTERVAL '5 days', now() - INTERVAL '1 hour', 'CLOSED', 0)
ON CONFLICT (id) DO NOTHING;

SELECT setval('auctions_id_seq', (SELECT MAX(id) FROM auctions));

INSERT INTO bids (auction_id, bidder_id, amount, status, reason, created_at) VALUES
  (1, 3, 510000.00, 'ACCEPTED', NULL, now() - INTERVAL '1 day'),
  (1, 2, 520000.00, 'ACCEPTED', NULL, now() - INTERVAL '12 hours'),
  (2, 2, 26000.00, 'ACCEPTED', NULL, now() - INTERVAL '18 hours'),
  (2, 3, 28000.00, 'ACCEPTED', NULL, now() - INTERVAL '6 hours'),
  (3, 2, 165000.00, 'ACCEPTED', NULL, now() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;
