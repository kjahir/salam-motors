SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict DG5s95bzJ3KMR5ddSJrAiPogWg1dlfEM2siGzhJwRmRMRzxr8gcgnjUSBJb3Hdp

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '1e726180-799d-4c95-9367-12921c104de6', 'authenticated', 'authenticated', 'jahir@gmail.com', '$2a$10$qen9GjaCmjvGkwyLFgVX1.R7a5OePhMr10j.BdPhbk3FPOkzoaIVC', '2026-07-21 15:20:34.457267+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-21 15:25:23.502754+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-07-21 15:20:34.440007+00', '2026-07-21 15:25:23.507638+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', 'authenticated', 'authenticated', 'claude-ovtest-1784904685@example.com', '$2a$10$zzjcVkI0ulfBFyXgfoxJUeZh4JVwLj/fl4Bu9Xu4WvWICo6nzVMBO', '2026-07-24 14:51:24.487+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 14:54:42.357429+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "b2124d51-dad8-4eb1-b6b4-03d13bb75583", "email": "claude-ovtest-1784904685@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 14:51:24.452805+00', '2026-07-24 14:54:42.386708+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '80c17091-eabf-4c5d-aec2-f440f9045d67', 'authenticated', 'authenticated', 'claude-mergefin-1784909173@example.com', '$2a$10$ofTXD8UDhunxXkWJN9/6YOSTncRq0Zo5iIOKelga3t9yxjoeST3RO', '2026-07-24 16:06:12.798933+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 16:07:03.036474+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "80c17091-eabf-4c5d-aec2-f440f9045d67", "email": "claude-mergefin-1784909173@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 16:06:12.776145+00', '2026-07-24 16:07:03.038594+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '961db30d-319f-4ffe-ba88-97c98a092e7f', 'authenticated', 'authenticated', 'claude-mergetest-1784908258@example.com', '$2a$10$YB1ohHtYgsv9lAAp3rEHHO8TpVTCYGwC6Mp5i0uwQ92DQtPuDqBJu', '2026-07-24 15:50:57.538738+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 15:51:50.194916+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "961db30d-319f-4ffe-ba88-97c98a092e7f", "email": "claude-mergetest-1784908258@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 15:50:57.515047+00', '2026-07-24 15:51:50.20852+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'c27c1ff6-b521-4b4c-ad89-394e50df7909', 'authenticated', 'authenticated', 'claude-salestest-1784908684@example.com', '$2a$10$KP.vLLpdCnHJbWuPaS8BMuSLFLKxA.qSkBV08rVbu4epB0rzRk2T.', '2026-07-24 15:58:03.54056+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 16:00:26.810171+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "c27c1ff6-b521-4b4c-ad89-394e50df7909", "email": "claude-salestest-1784908684@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 15:58:03.504901+00', '2026-07-24 16:00:26.81582+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '3dcfb03d-c997-453e-aff1-60dc174b7a97', 'authenticated', 'authenticated', 'kjahir@yahoo.com', '$2a$10$DqnkCGftEDUlc.EeY/d8ZO4gT8gtHLmBGkHcIFLcWZwOb5oLX1r5e', '2026-07-21 16:24:50.506281+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-26 08:16:24.352295+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-07-21 16:24:50.466901+00', '2026-07-26 08:16:24.367486+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '97d57315-8348-470f-9e53-c1b20f621268', 'authenticated', 'authenticated', 'nishajahir22@gmail.com', '', NULL, '2026-07-27 07:57:40.992393+00', '9959bc1789c639919f2331524f442a965e6895fa6ea23f64d3ada86a', '2026-07-27 07:57:40.992393+00', '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"role": "sales_executive", "org_id": "bf496ef5-ee27-429d-99d5-770d8b917c66"}', NULL, '2026-07-27 07:57:40.965797+00', '2026-07-27 07:57:42.454816+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '7dc3ea3c-c21f-4d81-83c8-8df394348152', 'authenticated', 'authenticated', 'claude-financetest-1784910438@example.com', '$2a$10$hdRA1JCX14WAMvhSMLC80OybP/HLhumzbt9v6CExi6Qf1NveertVu', '2026-07-24 16:27:17.570646+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 16:28:36.745494+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "7dc3ea3c-c21f-4d81-83c8-8df394348152", "email": "claude-financetest-1784910438@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 16:27:17.531254+00', '2026-07-24 16:28:36.758832+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '3feb92a6-61d7-4361-bfdc-43caa5747537', 'authenticated', 'authenticated', 'claude-uitest-1784900328@example.com', '$2a$10$PPPtjm0DsniF.QydQu3m4Or.7ofAj0PSNt8jJU.ERWYQMRhdBRqIS', '2026-07-24 13:38:47.680361+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 13:57:15.320851+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "3feb92a6-61d7-4361-bfdc-43caa5747537", "email": "claude-uitest-1784900328@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 13:38:47.645882+00', '2026-07-24 13:57:15.347652+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'authenticated', 'authenticated', 'salam@gmail.com', '$2a$10$pVgxvzN/D/SeI6Tkz3LZG.2mhw1rTn4jWibdmzzbA3ea0SvfT1jYW', '2026-07-21 14:59:32.405134+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-29 04:38:42.375241+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-07-21 14:59:32.386961+00', '2026-07-31 01:19:05.456969+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '38fafbc7-2b32-4618-acc6-2df779037584', 'authenticated', 'authenticated', 'claude-test-1784889693@example.com', '$2a$10$m7dpwSUmuPDYK/YW3TmCs.yEp2bHVB2wLTCK1XTgLL2o6y1m6/Ii6', '2026-07-24 10:41:33.565983+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 10:41:33.572212+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "38fafbc7-2b32-4618-acc6-2df779037584", "email": "claude-test-1784889693@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 10:41:33.554763+00', '2026-07-24 10:41:33.57517+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '100d13b9-906a-43b0-a42c-e77d6417bbf8', 'authenticated', 'authenticated', 'claude-invtest-1784911798@example.com', '$2a$10$uK4/gUqXVDZHzN1OAKc6o.GvbzzLBBQZZtMxpF6BdSmcRKmuWodr6', '2026-07-24 16:49:57.664408+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 16:55:41.473942+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "100d13b9-906a-43b0-a42c-e77d6417bbf8", "email": "claude-invtest-1784911798@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 16:49:57.632389+00', '2026-07-24 16:55:41.500365+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '57274be8-c311-497f-be9f-c608ed3e3580', 'authenticated', 'authenticated', 'claude-autosettle-1784912989@example.com', '$2a$10$3xLWcnWpZm1x5iBE6iupLe1BbXSvUJrkUCZcczVwagmStJ0nRNQui', '2026-07-24 17:09:49.171112+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 17:11:01.317487+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "57274be8-c311-497f-be9f-c608ed3e3580", "email": "claude-autosettle-1784912989@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 17:09:49.131249+00', '2026-07-24 17:11:01.319725+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'bfb47952-e6c1-414d-9bfa-4024b196913c', 'authenticated', 'authenticated', 'claude-vdtest-1784903452@example.com', '$2a$10$RT/P0Or9BoqkCT3WITwghOtrwpMKOXAJiPAEtGft2/E90NTM29B4u', '2026-07-24 14:30:52.125709+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 14:34:00.939962+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "bfb47952-e6c1-414d-9bfa-4024b196913c", "email": "claude-vdtest-1784903452@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 14:30:52.076922+00', '2026-07-24 14:34:00.956976+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '30e037db-f8dd-4bec-8e3f-e71b964cf8de', 'authenticated', 'authenticated', 'claude-mergefsp-1784914518@example.com', '$2a$10$tfiNlD.jzEwexq7a49pMgeTo5dWqMuHiv2EeN2//afUnkBryzCtOu', '2026-07-24 17:35:17.159367+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 17:36:19.431745+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "30e037db-f8dd-4bec-8e3f-e71b964cf8de", "email": "claude-mergefsp-1784914518@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 17:35:17.117168+00', '2026-07-24 17:36:19.445765+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', 'authenticated', 'authenticated', 'mobiletest+1784917540@example.com', '$2a$10$NAXLygOSMczOp3MVE49zruIC/UZyvFaBp7uqUU.FBC91pXuMMrlAq', '2026-07-24 18:25:39.795285+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-07-24 18:33:22.681452+00', '{"provider": "email", "providers": ["email"]}', '{"sub": "b867cd0a-1180-4fa4-8451-a93e71ea9819", "email": "mobiletest+1784917540@example.com", "email_verified": true, "phone_verified": false}', NULL, '2026-07-24 18:25:39.774954+00', '2026-07-24 18:33:22.683584+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('03c73ded-1ef7-4d98-9910-228dcbd95b8c', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{"sub": "03c73ded-1ef7-4d98-9910-228dcbd95b8c", "email": "salam@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-21 14:59:32.401505+00', '2026-07-21 14:59:32.401563+00', '2026-07-21 14:59:32.401563+00', '79f12ab1-d220-4d28-b6c8-4f5badc27bd3'),
	('1e726180-799d-4c95-9367-12921c104de6', '1e726180-799d-4c95-9367-12921c104de6', '{"sub": "1e726180-799d-4c95-9367-12921c104de6", "email": "jahir@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-21 15:20:34.453135+00', '2026-07-21 15:20:34.453184+00', '2026-07-21 15:20:34.453184+00', '94a73e42-5fd0-4017-b308-82db59e52581'),
	('3dcfb03d-c997-453e-aff1-60dc174b7a97', '3dcfb03d-c997-453e-aff1-60dc174b7a97', '{"sub": "3dcfb03d-c997-453e-aff1-60dc174b7a97", "email": "kjahir@yahoo.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-21 16:24:50.490197+00', '2026-07-21 16:24:50.490245+00', '2026-07-21 16:24:50.490245+00', '911882ce-22e0-4157-a16b-f7d90247ce12'),
	('38fafbc7-2b32-4618-acc6-2df779037584', '38fafbc7-2b32-4618-acc6-2df779037584', '{"sub": "38fafbc7-2b32-4618-acc6-2df779037584", "email": "claude-test-1784889693@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 10:41:33.561635+00', '2026-07-24 10:41:33.561674+00', '2026-07-24 10:41:33.561674+00', '5cc2f302-863b-468d-a126-aa27ef4ad524'),
	('3feb92a6-61d7-4361-bfdc-43caa5747537', '3feb92a6-61d7-4361-bfdc-43caa5747537', '{"sub": "3feb92a6-61d7-4361-bfdc-43caa5747537", "email": "claude-uitest-1784900328@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 13:38:47.673756+00', '2026-07-24 13:38:47.673804+00', '2026-07-24 13:38:47.673804+00', '54f42add-f0ac-4098-a2c1-370fc83799f9'),
	('bfb47952-e6c1-414d-9bfa-4024b196913c', 'bfb47952-e6c1-414d-9bfa-4024b196913c', '{"sub": "bfb47952-e6c1-414d-9bfa-4024b196913c", "email": "claude-vdtest-1784903452@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 14:30:52.112842+00', '2026-07-24 14:30:52.11291+00', '2026-07-24 14:30:52.11291+00', 'dc286241-aa09-4e4a-b67e-05ecb333cf08'),
	('b2124d51-dad8-4eb1-b6b4-03d13bb75583', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', '{"sub": "b2124d51-dad8-4eb1-b6b4-03d13bb75583", "email": "claude-ovtest-1784904685@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 14:51:24.478032+00', '2026-07-24 14:51:24.478114+00', '2026-07-24 14:51:24.478114+00', '0a918b9c-4240-435a-aa40-8285b902c51f'),
	('961db30d-319f-4ffe-ba88-97c98a092e7f', '961db30d-319f-4ffe-ba88-97c98a092e7f', '{"sub": "961db30d-319f-4ffe-ba88-97c98a092e7f", "email": "claude-mergetest-1784908258@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 15:50:57.53462+00', '2026-07-24 15:50:57.534665+00', '2026-07-24 15:50:57.534665+00', '9055162d-47bf-4621-ae6c-0642c443860e'),
	('c27c1ff6-b521-4b4c-ad89-394e50df7909', 'c27c1ff6-b521-4b4c-ad89-394e50df7909', '{"sub": "c27c1ff6-b521-4b4c-ad89-394e50df7909", "email": "claude-salestest-1784908684@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 15:58:03.53498+00', '2026-07-24 15:58:03.535017+00', '2026-07-24 15:58:03.535017+00', '4fcf7ad5-1748-47ac-bb2c-2b6de63154c0'),
	('80c17091-eabf-4c5d-aec2-f440f9045d67', '80c17091-eabf-4c5d-aec2-f440f9045d67', '{"sub": "80c17091-eabf-4c5d-aec2-f440f9045d67", "email": "claude-mergefin-1784909173@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 16:06:12.792314+00', '2026-07-24 16:06:12.79237+00', '2026-07-24 16:06:12.79237+00', 'f4e14a1f-953e-47d7-9313-e3fee759c72f'),
	('7dc3ea3c-c21f-4d81-83c8-8df394348152', '7dc3ea3c-c21f-4d81-83c8-8df394348152', '{"sub": "7dc3ea3c-c21f-4d81-83c8-8df394348152", "email": "claude-financetest-1784910438@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 16:27:17.563143+00', '2026-07-24 16:27:17.563202+00', '2026-07-24 16:27:17.563202+00', '1c725323-aa75-4fdb-86a6-0646edec9e70'),
	('100d13b9-906a-43b0-a42c-e77d6417bbf8', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '{"sub": "100d13b9-906a-43b0-a42c-e77d6417bbf8", "email": "claude-invtest-1784911798@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 16:49:57.658616+00', '2026-07-24 16:49:57.658658+00', '2026-07-24 16:49:57.658658+00', '89c9e71e-0f26-4328-a632-bd7b0ad0e5ec'),
	('57274be8-c311-497f-be9f-c608ed3e3580', '57274be8-c311-497f-be9f-c608ed3e3580', '{"sub": "57274be8-c311-497f-be9f-c608ed3e3580", "email": "claude-autosettle-1784912989@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 17:09:49.1617+00', '2026-07-24 17:09:49.161756+00', '2026-07-24 17:09:49.161756+00', '958bf7fe-57fe-44ee-b27b-8eb3ebc77dcb'),
	('30e037db-f8dd-4bec-8e3f-e71b964cf8de', '30e037db-f8dd-4bec-8e3f-e71b964cf8de', '{"sub": "30e037db-f8dd-4bec-8e3f-e71b964cf8de", "email": "claude-mergefsp-1784914518@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 17:35:17.152072+00', '2026-07-24 17:35:17.152134+00', '2026-07-24 17:35:17.152134+00', '602f4f06-5d99-42aa-8247-a42018edc52e'),
	('b867cd0a-1180-4fa4-8451-a93e71ea9819', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', '{"sub": "b867cd0a-1180-4fa4-8451-a93e71ea9819", "email": "mobiletest+1784917540@example.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-24 18:25:39.790991+00', '2026-07-24 18:25:39.791031+00', '2026-07-24 18:25:39.791031+00', 'cf475b21-0644-47ba-9402-5c9db8346ea9'),
	('97d57315-8348-470f-9e53-c1b20f621268', '97d57315-8348-470f-9e53-c1b20f621268', '{"sub": "97d57315-8348-470f-9e53-c1b20f621268", "email": "nishajahir22@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-07-27 07:57:40.986033+00', '2026-07-27 07:57:40.986081+00', '2026-07-27 07:57:40.986081+00', '566e36c9-6516-494b-a98a-116bb89a0c10');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('c177ec9c-530a-4679-895e-29553ee2dc37', '38fafbc7-2b32-4618-acc6-2df779037584', '2026-07-24 10:41:33.572305+00', '2026-07-24 10:41:33.572305+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('29a9d9b8-e56f-4772-9c19-2e12c73cbf0c', '961db30d-319f-4ffe-ba88-97c98a092e7f', '2026-07-24 15:51:23.635043+00', '2026-07-24 15:51:23.635043+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('0b3e97c1-ec72-44c7-8503-ba49b14d6d5e', '961db30d-319f-4ffe-ba88-97c98a092e7f', '2026-07-24 15:51:50.194997+00', '2026-07-24 15:51:50.194997+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('ffe0a253-30c3-41af-92b7-54caa184f0bb', 'c27c1ff6-b521-4b4c-ad89-394e50df7909', '2026-07-24 15:58:03.546415+00', '2026-07-24 15:58:03.546415+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('9324fd5e-a117-41e2-8870-ce45873276b7', 'c27c1ff6-b521-4b4c-ad89-394e50df7909', '2026-07-24 15:58:27.818911+00', '2026-07-24 15:58:27.818911+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('1fedf849-46e6-4e8e-a427-bb78f8dafe26', 'c27c1ff6-b521-4b4c-ad89-394e50df7909', '2026-07-24 16:00:26.810263+00', '2026-07-24 16:00:26.810263+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('1684dcad-cb47-4a58-9a1d-e02eb49495b1', '80c17091-eabf-4c5d-aec2-f440f9045d67', '2026-07-24 16:06:12.806034+00', '2026-07-24 16:06:12.806034+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('a9903aa6-bb3d-4d34-8c47-859454dd7d1d', '3feb92a6-61d7-4361-bfdc-43caa5747537', '2026-07-24 13:38:47.689268+00', '2026-07-24 13:38:47.689268+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('c2769693-703f-4d47-9e81-451e9d58edba', '80c17091-eabf-4c5d-aec2-f440f9045d67', '2026-07-24 16:06:36.661179+00', '2026-07-24 16:06:36.661179+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('756a25d2-3761-4254-bdb4-59293c08f75c', '80c17091-eabf-4c5d-aec2-f440f9045d67', '2026-07-24 16:07:03.036543+00', '2026-07-24 16:07:03.036543+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('ecd787b0-06fe-43a6-a9c7-7601ec8ff1eb', '7dc3ea3c-c21f-4d81-83c8-8df394348152', '2026-07-24 16:27:17.579394+00', '2026-07-24 16:27:17.579394+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('ab475b3d-833a-4587-a15b-1f5e15f8a16f', '3feb92a6-61d7-4361-bfdc-43caa5747537', '2026-07-24 13:39:13.604525+00', '2026-07-24 13:39:13.604525+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('ac75afca-2e78-42f9-be1a-2aac34696b3b', '3feb92a6-61d7-4361-bfdc-43caa5747537', '2026-07-24 13:41:44.463437+00', '2026-07-24 13:41:44.463437+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('3b77623e-7e43-4ce8-b982-bcb4fdf06da4', '3feb92a6-61d7-4361-bfdc-43caa5747537', '2026-07-24 13:42:12.635106+00', '2026-07-24 13:42:12.635106+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('feabd8ef-7c55-4bae-a1e6-7749396bd002', '3feb92a6-61d7-4361-bfdc-43caa5747537', '2026-07-24 13:52:57.863897+00', '2026-07-24 13:52:57.863897+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('4d21a68c-7ff8-4286-a98f-b5ac52454c8d', '3feb92a6-61d7-4361-bfdc-43caa5747537', '2026-07-24 13:53:18.257054+00', '2026-07-24 13:53:18.257054+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('9ed84fc6-0481-43f7-8b5e-5e94834fb2e3', '3feb92a6-61d7-4361-bfdc-43caa5747537', '2026-07-24 13:53:50.472036+00', '2026-07-24 13:53:50.472036+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('9c1dbfbb-2beb-415b-9379-562b1dbb69cd', '3feb92a6-61d7-4361-bfdc-43caa5747537', '2026-07-24 13:54:05.467545+00', '2026-07-24 13:54:05.467545+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('bef55010-762f-4c0f-83d4-0bfbdfabdb60', '3feb92a6-61d7-4361-bfdc-43caa5747537', '2026-07-24 13:57:15.321688+00', '2026-07-24 13:57:15.321688+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('078d6ba9-d1b3-40ec-9899-66d2a792b9d5', 'bfb47952-e6c1-414d-9bfa-4024b196913c', '2026-07-24 14:30:52.135247+00', '2026-07-24 14:30:52.135247+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('7d6fe9c1-30ce-413a-b29f-67c0715276b9', 'bfb47952-e6c1-414d-9bfa-4024b196913c', '2026-07-24 14:31:10.247549+00', '2026-07-24 14:31:10.247549+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('720480ef-5da6-4fe7-b010-066aa1306632', 'bfb47952-e6c1-414d-9bfa-4024b196913c', '2026-07-24 14:34:00.9406+00', '2026-07-24 14:34:00.9406+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('a6af6ca4-66ea-4058-b8a6-b773e2f151c8', '7dc3ea3c-c21f-4d81-83c8-8df394348152', '2026-07-24 16:27:47.214119+00', '2026-07-24 16:27:47.214119+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('2f86983e-69ee-4b3d-845b-5c179be3bd56', '7dc3ea3c-c21f-4d81-83c8-8df394348152', '2026-07-24 16:28:36.746482+00', '2026-07-24 16:28:36.746482+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('dacb3581-9514-43a0-b0fb-15c855393e2a', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', '2026-07-24 14:51:24.496468+00', '2026-07-24 14:51:24.496468+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('43f6e3f2-e2f9-4732-a2f8-08e5445f8b9c', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', '2026-07-24 14:51:37.073475+00', '2026-07-24 14:51:37.073475+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('a876bafd-c55a-4ef6-8302-3919f4b8c71f', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', '2026-07-24 14:52:28.851866+00', '2026-07-24 14:52:28.851866+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('6548384c-bc55-4425-86e1-2de422bdf0fd', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', '2026-07-24 14:52:39.855365+00', '2026-07-24 14:52:39.855365+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('555784d6-f146-4589-bea3-0241e147c312', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', '2026-07-24 14:54:42.35816+00', '2026-07-24 14:54:42.35816+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('2d70fac6-bd3b-472a-8477-dd5d773fa757', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '2026-07-24 16:55:41.474626+00', '2026-07-24 16:55:41.474626+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('a6942cb6-1375-4a2d-9485-ed032ab51714', '30e037db-f8dd-4bec-8e3f-e71b964cf8de', '2026-07-24 17:35:45.940755+00', '2026-07-24 17:35:45.940755+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('d8bc3f8c-a6fa-49bc-b921-f29f0b7dc3ad', '961db30d-319f-4ffe-ba88-97c98a092e7f', '2026-07-24 15:50:57.545259+00', '2026-07-24 15:50:57.545259+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('9a83465c-10a8-4d49-8ae4-2e05c80b0daa', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '2026-07-24 16:49:57.671158+00', '2026-07-24 16:49:57.671158+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('4c982417-c661-46ec-991f-ba4beb7c3cb0', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '2026-07-24 16:50:29.530348+00', '2026-07-24 16:50:29.530348+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('6a4929e7-dc37-47b0-942a-5a7128c9e0ec', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '2026-07-24 16:51:29.444857+00', '2026-07-24 16:51:29.444857+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('85e810c1-9e19-49a7-8591-7ddf897c3359', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '2026-07-24 16:52:02.401269+00', '2026-07-24 16:52:02.401269+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('3fb8b24a-357b-4275-bdf9-4cb642daa794', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '2026-07-24 16:52:46.166104+00', '2026-07-24 16:52:46.166104+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('c5aa687e-2d3d-47be-abd4-9f9100979b6d', '57274be8-c311-497f-be9f-c608ed3e3580', '2026-07-24 17:09:49.181619+00', '2026-07-24 17:09:49.181619+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('b3670e02-eb71-472c-9c88-0989f48bd9fb', '57274be8-c311-497f-be9f-c608ed3e3580', '2026-07-24 17:10:18.339783+00', '2026-07-24 17:10:18.339783+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('3a7594dd-6f22-453c-bdbf-dcce0db0664b', '57274be8-c311-497f-be9f-c608ed3e3580', '2026-07-24 17:11:01.317595+00', '2026-07-24 17:11:01.317595+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('c2af7286-eca9-476d-8a9a-ebfcd55e3f54', '30e037db-f8dd-4bec-8e3f-e71b964cf8de', '2026-07-24 17:35:17.172848+00', '2026-07-24 17:35:17.172848+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('e4c5be1d-19cd-4661-ab93-a9ba91343475', '30e037db-f8dd-4bec-8e3f-e71b964cf8de', '2026-07-24 17:36:19.432485+00', '2026-07-24 17:36:19.432485+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('218643b2-c620-4ed6-8b71-23d012c3eb0c', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', '2026-07-24 18:25:39.803759+00', '2026-07-24 18:25:39.803759+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('c626f7fb-e25d-4939-bedd-a5ff3059b522', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', '2026-07-24 18:26:48.776162+00', '2026-07-24 18:26:48.776162+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('241e00ff-b319-4468-9c54-af55bea82d42', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', '2026-07-24 18:27:42.085811+00', '2026-07-24 18:27:42.085811+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('fb54c565-ef8d-48cb-8329-42e52f37f22d', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', '2026-07-24 18:28:53.897907+00', '2026-07-24 18:28:53.897907+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('5f039536-4084-4887-a5fc-696b949236bf', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', '2026-07-24 18:29:57.375912+00', '2026-07-24 18:29:57.375912+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('00946fac-9b34-412c-8dcb-17a60968a331', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', '2026-07-24 18:31:05.02119+00', '2026-07-24 18:31:05.02119+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('03bb8771-a3c4-4ea9-a45d-440444670804', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', '2026-07-24 18:31:54.331874+00', '2026-07-24 18:31:54.331874+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('fa7e2508-47c2-4e23-ab9c-e85ec6863072', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', '2026-07-24 18:32:47.636185+00', '2026-07-24 18:32:47.636185+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/148.0.7778.96 Safari/537.36', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('0617ff71-4b07-4ab7-bb32-d72d9a9a98dc', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', '2026-07-24 18:33:22.681548+00', '2026-07-24 18:33:22.681548+00', NULL, 'aal1', NULL, NULL, 'curl/8.5.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('9aeefa92-4ffa-42e0-ad2b-09a2f1b4508e', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-27 12:42:40.128142+00', '2026-07-27 14:42:49.945113+00', NULL, 'aal1', NULL, '2026-07-27 14:42:49.944999', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('c0f2fe98-7a44-479e-b3c0-69d44369df80', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-27 19:23:56.975429+00', '2026-07-27 19:23:56.975429+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0', '223.239.57.2', NULL, NULL, NULL, NULL, NULL),
	('1448626c-ce9e-49d6-93d9-eff5ca3f92e3', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-28 03:04:39.282798+00', '2026-07-30 09:33:13.174583+00', NULL, 'aal1', NULL, '2026-07-30 09:33:13.174486', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('f08f68ad-47ee-4d57-a2a1-a36cb797907a', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-29 04:38:42.376076+00', '2026-07-30 09:50:48.22559+00', NULL, 'aal1', NULL, '2026-07-30 09:50:48.225473', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('1a916205-633f-4243-8306-0ff33a709671', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-28 02:39:58.466149+00', '2026-07-28 15:01:23.288691+00', NULL, 'aal1', NULL, '2026-07-28 15:01:23.288595', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('541774a6-99c9-45dd-9417-f2f268c8d05e', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-27 10:57:16.530313+00', '2026-07-30 17:20:09.430847+00', NULL, 'aal1', NULL, '2026-07-30 17:20:09.43072', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1', '119.234.148.68', NULL, NULL, NULL, NULL, NULL),
	('faf72bdd-ce06-4e03-877d-e3d60c62a2f6', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-27 17:51:52.966281+00', '2026-07-31 01:19:05.487427+00', NULL, 'aal1', NULL, '2026-07-31 01:19:05.487324', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36', '49.37.194.99', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('c177ec9c-530a-4679-895e-29553ee2dc37', '2026-07-24 10:41:33.575661+00', '2026-07-24 10:41:33.575661+00', 'password', '62b363e3-0d2d-4e13-99a8-df81a1219019'),
	('a9903aa6-bb3d-4d34-8c47-859454dd7d1d', '2026-07-24 13:38:47.698168+00', '2026-07-24 13:38:47.698168+00', 'password', '8694cde1-586b-44f1-b8af-946d3da28c43'),
	('ab475b3d-833a-4587-a15b-1f5e15f8a16f', '2026-07-24 13:39:13.608821+00', '2026-07-24 13:39:13.608821+00', 'password', '0e217e79-461c-4434-89a0-b5ebcc121f52'),
	('ac75afca-2e78-42f9-be1a-2aac34696b3b', '2026-07-24 13:41:44.469361+00', '2026-07-24 13:41:44.469361+00', 'password', 'b1c6789a-0233-487e-8392-03891fcfebe0'),
	('3b77623e-7e43-4ce8-b982-bcb4fdf06da4', '2026-07-24 13:42:12.642774+00', '2026-07-24 13:42:12.642774+00', 'password', '8081fcfb-7792-441d-ad13-61c4a69f088f'),
	('feabd8ef-7c55-4bae-a1e6-7749396bd002', '2026-07-24 13:52:57.876011+00', '2026-07-24 13:52:57.876011+00', 'password', '9b1a6057-8d59-450a-9618-3157d8418cf2'),
	('4d21a68c-7ff8-4286-a98f-b5ac52454c8d', '2026-07-24 13:53:18.259353+00', '2026-07-24 13:53:18.259353+00', 'password', 'ca3b47eb-5ad7-4216-91ba-98e4d87cf2ae'),
	('9ed84fc6-0481-43f7-8b5e-5e94834fb2e3', '2026-07-24 13:53:50.503578+00', '2026-07-24 13:53:50.503578+00', 'password', '9574e52c-2e5c-491d-b4f5-cdf0bd62950d'),
	('9c1dbfbb-2beb-415b-9379-562b1dbb69cd', '2026-07-24 13:54:05.470358+00', '2026-07-24 13:54:05.470358+00', 'password', 'fb123e71-1ed9-4682-a574-58cb7863af0f'),
	('bef55010-762f-4c0f-83d4-0bfbdfabdb60', '2026-07-24 13:57:15.351147+00', '2026-07-24 13:57:15.351147+00', 'password', '13c4aad2-169b-4461-94ad-993c4839f82b'),
	('078d6ba9-d1b3-40ec-9899-66d2a792b9d5', '2026-07-24 14:30:52.157003+00', '2026-07-24 14:30:52.157003+00', 'password', '7775929c-7f7e-4c4b-b733-fb4fbb044548'),
	('7d6fe9c1-30ce-413a-b29f-67c0715276b9', '2026-07-24 14:31:10.252453+00', '2026-07-24 14:31:10.252453+00', 'password', '3e549744-6d3b-4c19-ac7f-7dd1f50a6bc5'),
	('720480ef-5da6-4fe7-b010-066aa1306632', '2026-07-24 14:34:00.958496+00', '2026-07-24 14:34:00.958496+00', 'password', '81ebc027-50cf-4696-8689-c8a6143b7ad2'),
	('dacb3581-9514-43a0-b0fb-15c855393e2a', '2026-07-24 14:51:24.514616+00', '2026-07-24 14:51:24.514616+00', 'password', 'bcb2714f-3709-49d3-a9b8-902f092d26e5'),
	('43f6e3f2-e2f9-4732-a2f8-08e5445f8b9c', '2026-07-24 14:51:37.077584+00', '2026-07-24 14:51:37.077584+00', 'password', '7f9bd7de-c7ea-4461-b641-2eba319de4cd'),
	('a876bafd-c55a-4ef6-8302-3919f4b8c71f', '2026-07-24 14:52:28.86102+00', '2026-07-24 14:52:28.86102+00', 'password', '79a99e8e-5483-445f-bd78-fa4f46a2f221'),
	('6548384c-bc55-4425-86e1-2de422bdf0fd', '2026-07-24 14:52:39.858216+00', '2026-07-24 14:52:39.858216+00', 'password', '20ce8eb7-1888-4c9b-a70c-e7ec09746103'),
	('555784d6-f146-4589-bea3-0241e147c312', '2026-07-24 14:54:42.391107+00', '2026-07-24 14:54:42.391107+00', 'password', 'f7411604-1f1c-4ea2-9c18-40c690f0b059'),
	('d8bc3f8c-a6fa-49bc-b921-f29f0b7dc3ad', '2026-07-24 15:50:57.549822+00', '2026-07-24 15:50:57.549822+00', 'password', '98388f6e-c354-4e7f-ad99-22bc39da45ae'),
	('29a9d9b8-e56f-4772-9c19-2e12c73cbf0c', '2026-07-24 15:51:23.63907+00', '2026-07-24 15:51:23.63907+00', 'password', 'aeb06d33-cf5c-4d19-acec-e50d253830d4'),
	('0b3e97c1-ec72-44c7-8503-ba49b14d6d5e', '2026-07-24 15:51:50.2105+00', '2026-07-24 15:51:50.2105+00', 'password', 'ca406e25-9ac9-430e-a313-43f9796b0586'),
	('ffe0a253-30c3-41af-92b7-54caa184f0bb', '2026-07-24 15:58:03.554349+00', '2026-07-24 15:58:03.554349+00', 'password', '7c9b4c4d-5f2d-4dab-b2be-1dedec64bc55'),
	('9324fd5e-a117-41e2-8870-ce45873276b7', '2026-07-24 15:58:27.822417+00', '2026-07-24 15:58:27.822417+00', 'password', 'f7a2b101-9ac1-4923-a3f4-a12ec771f1b3'),
	('1fedf849-46e6-4e8e-a427-bb78f8dafe26', '2026-07-24 16:00:26.817915+00', '2026-07-24 16:00:26.817915+00', 'password', '2eb8317a-0e2d-4dc2-b441-dd999b333e28'),
	('1684dcad-cb47-4a58-9a1d-e02eb49495b1', '2026-07-24 16:06:12.810687+00', '2026-07-24 16:06:12.810687+00', 'password', '3e1b1369-0ce1-4af1-a064-18c0604106ea'),
	('c2769693-703f-4d47-9e81-451e9d58edba', '2026-07-24 16:06:36.665172+00', '2026-07-24 16:06:36.665172+00', 'password', 'b92cb209-581d-4c18-af37-dd97d7569fd2'),
	('756a25d2-3761-4254-bdb4-59293c08f75c', '2026-07-24 16:07:03.038956+00', '2026-07-24 16:07:03.038956+00', 'password', 'ddd5efc4-e775-4de0-af6a-d2f3eccd2394'),
	('ecd787b0-06fe-43a6-a9c7-7601ec8ff1eb', '2026-07-24 16:27:17.594771+00', '2026-07-24 16:27:17.594771+00', 'password', 'b332cf07-c001-4921-bd9d-31eef7293a90'),
	('a6af6ca4-66ea-4058-b8a6-b773e2f151c8', '2026-07-24 16:27:47.218419+00', '2026-07-24 16:27:47.218419+00', 'password', 'e6fdb00b-8d7c-4ab6-ab8e-800874357926'),
	('2f86983e-69ee-4b3d-845b-5c179be3bd56', '2026-07-24 16:28:36.759743+00', '2026-07-24 16:28:36.759743+00', 'password', '199e2884-5370-4194-a24a-127525196b6c'),
	('9a83465c-10a8-4d49-8ae4-2e05c80b0daa', '2026-07-24 16:49:57.677099+00', '2026-07-24 16:49:57.677099+00', 'password', '2d6c5f99-fb0d-4843-b851-778bd2baca07'),
	('4c982417-c661-46ec-991f-ba4beb7c3cb0', '2026-07-24 16:50:29.544232+00', '2026-07-24 16:50:29.544232+00', 'password', '6cfc8f10-630f-4a5b-8955-5dbfffbe5dc8'),
	('6a4929e7-dc37-47b0-942a-5a7128c9e0ec', '2026-07-24 16:51:29.448588+00', '2026-07-24 16:51:29.448588+00', 'password', '6ce69968-e75f-49df-93ee-5a791eab75ba'),
	('85e810c1-9e19-49a7-8591-7ddf897c3359', '2026-07-24 16:52:02.403754+00', '2026-07-24 16:52:02.403754+00', 'password', 'ee66fa99-02b9-4f8b-8af7-f80961de48c7'),
	('3fb8b24a-357b-4275-bdf9-4cb642daa794', '2026-07-24 16:52:46.170071+00', '2026-07-24 16:52:46.170071+00', 'password', 'd5b3ac3e-e4b8-4c60-b643-faf1ebcc4100'),
	('2d70fac6-bd3b-472a-8477-dd5d773fa757', '2026-07-24 16:55:41.502705+00', '2026-07-24 16:55:41.502705+00', 'password', 'a3289e0c-edb8-43cc-aeab-e0fafba43299'),
	('c5aa687e-2d3d-47be-abd4-9f9100979b6d', '2026-07-24 17:09:49.196317+00', '2026-07-24 17:09:49.196317+00', 'password', '59dedcd0-e631-4f4f-b996-e862ff3abb6a'),
	('b3670e02-eb71-472c-9c88-0989f48bd9fb', '2026-07-24 17:10:18.354738+00', '2026-07-24 17:10:18.354738+00', 'password', '0d0b259b-f549-424d-92d9-dfb27ee38699'),
	('3a7594dd-6f22-453c-bdbf-dcce0db0664b', '2026-07-24 17:11:01.320082+00', '2026-07-24 17:11:01.320082+00', 'password', '28462bc5-3d89-4be9-9f07-c6bf6bfc9794'),
	('c2af7286-eca9-476d-8a9a-ebfcd55e3f54', '2026-07-24 17:35:17.197257+00', '2026-07-24 17:35:17.197257+00', 'password', '3728d16c-e24a-4aaf-a0a1-b2e749d33f10'),
	('a6942cb6-1375-4a2d-9485-ed032ab51714', '2026-07-24 17:35:45.944805+00', '2026-07-24 17:35:45.944805+00', 'password', '9f3a33c3-4f31-4fc2-9b99-1c06ed00f309'),
	('e4c5be1d-19cd-4661-ab93-a9ba91343475', '2026-07-24 17:36:19.447204+00', '2026-07-24 17:36:19.447204+00', 'password', '009bf231-7e84-434b-9781-010514ed3663'),
	('218643b2-c620-4ed6-8b71-23d012c3eb0c', '2026-07-24 18:25:39.810555+00', '2026-07-24 18:25:39.810555+00', 'password', '940861c0-91ff-47f0-96be-28fe58138239'),
	('c626f7fb-e25d-4939-bedd-a5ff3059b522', '2026-07-24 18:26:48.792818+00', '2026-07-24 18:26:48.792818+00', 'password', 'b6b97b49-89d1-4891-93db-8135c24025b2'),
	('241e00ff-b319-4468-9c54-af55bea82d42', '2026-07-24 18:27:42.091676+00', '2026-07-24 18:27:42.091676+00', 'password', '575441c1-9bda-4e34-810c-b1a4d80babc2'),
	('fb54c565-ef8d-48cb-8329-42e52f37f22d', '2026-07-24 18:28:53.903144+00', '2026-07-24 18:28:53.903144+00', 'password', 'b5309bac-1dc4-4f59-89be-5e64a433bb87'),
	('5f039536-4084-4887-a5fc-696b949236bf', '2026-07-24 18:29:57.379737+00', '2026-07-24 18:29:57.379737+00', 'password', 'bfc1dcd6-ee77-4ae6-a985-5827eef21720'),
	('00946fac-9b34-412c-8dcb-17a60968a331', '2026-07-24 18:31:05.084134+00', '2026-07-24 18:31:05.084134+00', 'password', '41a3b606-aa62-4ac6-ac48-bdd0bdff7d0b'),
	('03bb8771-a3c4-4ea9-a45d-440444670804', '2026-07-24 18:31:54.336297+00', '2026-07-24 18:31:54.336297+00', 'password', '82c51de2-33c3-4489-9d20-6e80145c918e'),
	('fa7e2508-47c2-4e23-ab9c-e85ec6863072', '2026-07-24 18:32:47.643998+00', '2026-07-24 18:32:47.643998+00', 'password', 'db31c169-1149-46c8-a8f4-435a456ba14d'),
	('0617ff71-4b07-4ab7-bb32-d72d9a9a98dc', '2026-07-24 18:33:22.683941+00', '2026-07-24 18:33:22.683941+00', 'password', 'e561ad1d-e656-46cf-bef2-52d69aaf7a62'),
	('541774a6-99c9-45dd-9417-f2f268c8d05e', '2026-07-27 10:57:16.560935+00', '2026-07-27 10:57:16.560935+00', 'password', 'fac02d01-363a-4098-af9e-eff48ec5e50d'),
	('9aeefa92-4ffa-42e0-ad2b-09a2f1b4508e', '2026-07-27 12:42:40.180717+00', '2026-07-27 12:42:40.180717+00', 'password', 'ea8b01c3-252e-4afa-919d-1d6eaea28f8e'),
	('faf72bdd-ce06-4e03-877d-e3d60c62a2f6', '2026-07-27 17:51:53.028802+00', '2026-07-27 17:51:53.028802+00', 'password', 'd596c104-f494-4a49-9db4-0d1a2f93290c'),
	('c0f2fe98-7a44-479e-b3c0-69d44369df80', '2026-07-27 19:23:57.010342+00', '2026-07-27 19:23:57.010342+00', 'password', '8f5baea7-6046-4a5d-9c6c-ea4d653631cb'),
	('1a916205-633f-4243-8306-0ff33a709671', '2026-07-28 02:39:58.505628+00', '2026-07-28 02:39:58.505628+00', 'password', 'eb02e37f-6c85-4a0b-8000-841c7672ca4f'),
	('1448626c-ce9e-49d6-93d9-eff5ca3f92e3', '2026-07-28 03:04:39.321339+00', '2026-07-28 03:04:39.321339+00', 'password', '59f95d6f-ddb3-4a54-98ed-3142c69236d7'),
	('f08f68ad-47ee-4d57-a2a1-a36cb797907a', '2026-07-29 04:38:42.402467+00', '2026-07-29 04:38:42.402467+00', 'password', '2f4347e6-5036-4884-8dfa-1734283ecaea');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at") VALUES
	('c6d9c2e4-8555-42a8-8f07-c9ecb481b1cf', '97d57315-8348-470f-9e53-c1b20f621268', 'confirmation_token', '9959bc1789c639919f2331524f442a965e6895fa6ea23f64d3ada86a', 'nishajahir22@gmail.com', '2026-07-27 07:57:42.460311', '2026-07-27 07:57:42.460311');


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 177, 'bnomc7hifwmm', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-27 18:57:19.313876+00', '2026-07-29 06:16:57.235735+00', 'ch5ei3jmwax5', 'faf72bdd-ce06-4e03-877d-e3d60c62a2f6'),
	('00000000-0000-0000-0000-000000000000', 192, 'a27r2lmvyqcp', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-29 04:38:42.39195+00', '2026-07-29 09:53:48.57313+00', NULL, 'f08f68ad-47ee-4d57-a2a1-a36cb797907a'),
	('00000000-0000-0000-0000-000000000000', 190, 'ckuw3aelpwlp', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-29 02:39:21.152699+00', '2026-07-29 11:00:58.744009+00', '3m4zf4vhypqu', '1448626c-ce9e-49d6-93d9-eff5ca3f92e3'),
	('00000000-0000-0000-0000-000000000000', 196, 'lk2quibvfcck', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-29 11:00:58.765408+00', '2026-07-29 13:02:50.759181+00', 'ckuw3aelpwlp', '1448626c-ce9e-49d6-93d9-eff5ca3f92e3'),
	('00000000-0000-0000-0000-000000000000', 198, 'muuhynlmjsy7', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', false, '2026-07-30 09:33:13.142723+00', '2026-07-30 09:33:13.142723+00', 'vrxgyev672rn', '1448626c-ce9e-49d6-93d9-eff5ca3f92e3'),
	('00000000-0000-0000-0000-000000000000', 194, 'w2pv3j7awj2w', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-29 06:16:57.24533+00', '2026-07-30 14:14:42.101731+00', 'bnomc7hifwmm', 'faf72bdd-ce06-4e03-877d-e3d60c62a2f6'),
	('00000000-0000-0000-0000-000000000000', 200, 'jt3hnr6qep5k', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-30 14:14:42.1169+00', '2026-07-30 15:31:08.443381+00', 'w2pv3j7awj2w', 'faf72bdd-ce06-4e03-877d-e3d60c62a2f6'),
	('00000000-0000-0000-0000-000000000000', 202, 'xx7mt3zvvvtx', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', false, '2026-07-30 17:20:09.397417+00', '2026-07-30 17:20:09.397417+00', '53ox3uwjz6rw', '541774a6-99c9-45dd-9417-f2f268c8d05e'),
	('00000000-0000-0000-0000-000000000000', 173, 'hoxioakvmbsb', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-27 12:42:40.159067+00', '2026-07-27 13:41:46.823588+00', NULL, '9aeefa92-4ffa-42e0-ad2b-09a2f1b4508e'),
	('00000000-0000-0000-0000-000000000000', 175, 'gnuoaso63kld', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', false, '2026-07-27 14:42:49.922755+00', '2026-07-27 14:42:49.922755+00', '3mvt3zok4enu', '9aeefa92-4ffa-42e0-ad2b-09a2f1b4508e'),
	('00000000-0000-0000-0000-000000000000', 181, '7tcwwxx55ah7', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-28 10:44:44.639373+00', '2026-07-28 13:29:25.422501+00', 'v6yf2xw76ubm', '1448626c-ce9e-49d6-93d9-eff5ca3f92e3'),
	('00000000-0000-0000-0000-000000000000', 179, 'o554537hiwzv', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-28 02:39:58.484701+00', '2026-07-28 15:01:23.247251+00', NULL, '1a916205-633f-4243-8306-0ff33a709671'),
	('00000000-0000-0000-0000-000000000000', 185, 'zjbykymrnsbr', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', false, '2026-07-28 15:01:23.262855+00', '2026-07-28 15:01:23.262855+00', 'o554537hiwzv', '1a916205-633f-4243-8306-0ff33a709671'),
	('00000000-0000-0000-0000-000000000000', 186, 'wgyhuvzr6kdi', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-28 15:01:41.89535+00', '2026-07-28 16:03:14.857491+00', 'oyufrio75loq', '1448626c-ce9e-49d6-93d9-eff5ca3f92e3'),
	('00000000-0000-0000-0000-000000000000', 183, 'jlsdbykewvnb', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-28 12:00:09.010375+00', '2026-07-28 23:30:20.863583+00', '4sexy6dhmvo5', '541774a6-99c9-45dd-9417-f2f268c8d05e'),
	('00000000-0000-0000-0000-000000000000', 188, 'ie2lcnjeutjx', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-28 23:30:20.887861+00', '2026-07-29 00:55:28.374344+00', 'jlsdbykewvnb', '541774a6-99c9-45dd-9417-f2f268c8d05e'),
	('00000000-0000-0000-0000-000000000000', 35, 'tjg2jgdadrjn', '38fafbc7-2b32-4618-acc6-2df779037584', false, '2026-07-24 10:41:33.57355+00', '2026-07-24 10:41:33.57355+00', NULL, 'c177ec9c-530a-4679-895e-29553ee2dc37'),
	('00000000-0000-0000-0000-000000000000', 42, 'bumdicdz3q2z', '3feb92a6-61d7-4361-bfdc-43caa5747537', false, '2026-07-24 13:38:47.694005+00', '2026-07-24 13:38:47.694005+00', NULL, 'a9903aa6-bb3d-4d34-8c47-859454dd7d1d'),
	('00000000-0000-0000-0000-000000000000', 43, 'us4smbqzlea2', '3feb92a6-61d7-4361-bfdc-43caa5747537', false, '2026-07-24 13:39:13.607593+00', '2026-07-24 13:39:13.607593+00', NULL, 'ab475b3d-833a-4587-a15b-1f5e15f8a16f'),
	('00000000-0000-0000-0000-000000000000', 45, 'lnt7yqgl5xog', '3feb92a6-61d7-4361-bfdc-43caa5747537', false, '2026-07-24 13:41:44.465552+00', '2026-07-24 13:41:44.465552+00', NULL, 'ac75afca-2e78-42f9-be1a-2aac34696b3b'),
	('00000000-0000-0000-0000-000000000000', 46, 'cnnn4pcuu5fw', '3feb92a6-61d7-4361-bfdc-43caa5747537', false, '2026-07-24 13:42:12.640188+00', '2026-07-24 13:42:12.640188+00', NULL, '3b77623e-7e43-4ce8-b982-bcb4fdf06da4'),
	('00000000-0000-0000-0000-000000000000', 47, 'mcat5qxofosw', '3feb92a6-61d7-4361-bfdc-43caa5747537', false, '2026-07-24 13:52:57.870768+00', '2026-07-24 13:52:57.870768+00', NULL, 'feabd8ef-7c55-4bae-a1e6-7749396bd002'),
	('00000000-0000-0000-0000-000000000000', 48, 'l7dw3k65kdm7', '3feb92a6-61d7-4361-bfdc-43caa5747537', false, '2026-07-24 13:53:18.258142+00', '2026-07-24 13:53:18.258142+00', NULL, '4d21a68c-7ff8-4286-a98f-b5ac52454c8d'),
	('00000000-0000-0000-0000-000000000000', 49, '3r6nkkj7ra7s', '3feb92a6-61d7-4361-bfdc-43caa5747537', false, '2026-07-24 13:53:50.485573+00', '2026-07-24 13:53:50.485573+00', NULL, '9ed84fc6-0481-43f7-8b5e-5e94834fb2e3'),
	('00000000-0000-0000-0000-000000000000', 50, '6yjbc6i2gcwx', '3feb92a6-61d7-4361-bfdc-43caa5747537', false, '2026-07-24 13:54:05.468888+00', '2026-07-24 13:54:05.468888+00', NULL, '9c1dbfbb-2beb-415b-9379-562b1dbb69cd'),
	('00000000-0000-0000-0000-000000000000', 51, 'w5ekdpyg3wix', '3feb92a6-61d7-4361-bfdc-43caa5747537', false, '2026-07-24 13:57:15.336002+00', '2026-07-24 13:57:15.336002+00', NULL, 'bef55010-762f-4c0f-83d4-0bfbdfabdb60'),
	('00000000-0000-0000-0000-000000000000', 52, 'ip43z4ha4zq3', 'bfb47952-e6c1-414d-9bfa-4024b196913c', false, '2026-07-24 14:30:52.146636+00', '2026-07-24 14:30:52.146636+00', NULL, '078d6ba9-d1b3-40ec-9899-66d2a792b9d5'),
	('00000000-0000-0000-0000-000000000000', 53, '3vk6lgc5g2gd', 'bfb47952-e6c1-414d-9bfa-4024b196913c', false, '2026-07-24 14:31:10.251158+00', '2026-07-24 14:31:10.251158+00', NULL, '7d6fe9c1-30ce-413a-b29f-67c0715276b9'),
	('00000000-0000-0000-0000-000000000000', 54, 'm42jstydeook', 'bfb47952-e6c1-414d-9bfa-4024b196913c', false, '2026-07-24 14:34:00.953119+00', '2026-07-24 14:34:00.953119+00', NULL, '720480ef-5da6-4fe7-b010-066aa1306632'),
	('00000000-0000-0000-0000-000000000000', 57, 'zlovpodvfee7', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', false, '2026-07-24 14:51:24.509839+00', '2026-07-24 14:51:24.509839+00', NULL, 'dacb3581-9514-43a0-b0fb-15c855393e2a'),
	('00000000-0000-0000-0000-000000000000', 58, 'l5cn5hvfu6i5', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', false, '2026-07-24 14:51:37.07638+00', '2026-07-24 14:51:37.07638+00', NULL, '43f6e3f2-e2f9-4732-a2f8-08e5445f8b9c'),
	('00000000-0000-0000-0000-000000000000', 59, 'ommoqqf2wdtm', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', false, '2026-07-24 14:52:28.857781+00', '2026-07-24 14:52:28.857781+00', NULL, 'a876bafd-c55a-4ef6-8302-3919f4b8c71f'),
	('00000000-0000-0000-0000-000000000000', 60, 'zts6eekn3v62', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', false, '2026-07-24 14:52:39.856967+00', '2026-07-24 14:52:39.856967+00', NULL, '6548384c-bc55-4425-86e1-2de422bdf0fd'),
	('00000000-0000-0000-0000-000000000000', 61, 'ybrm3nrcq6hr', 'b2124d51-dad8-4eb1-b6b4-03d13bb75583', false, '2026-07-24 14:54:42.378107+00', '2026-07-24 14:54:42.378107+00', NULL, '555784d6-f146-4589-bea3-0241e147c312'),
	('00000000-0000-0000-0000-000000000000', 67, '6rmcarxrrfgn', '961db30d-319f-4ffe-ba88-97c98a092e7f', false, '2026-07-24 15:50:57.546545+00', '2026-07-24 15:50:57.546545+00', NULL, 'd8bc3f8c-a6fa-49bc-b921-f29f0b7dc3ad'),
	('00000000-0000-0000-0000-000000000000', 68, 'qcz5xzwlg7dr', '961db30d-319f-4ffe-ba88-97c98a092e7f', false, '2026-07-24 15:51:23.637515+00', '2026-07-24 15:51:23.637515+00', NULL, '29a9d9b8-e56f-4772-9c19-2e12c73cbf0c'),
	('00000000-0000-0000-0000-000000000000', 69, '4ryrjvufetkd', '961db30d-319f-4ffe-ba88-97c98a092e7f', false, '2026-07-24 15:51:50.207117+00', '2026-07-24 15:51:50.207117+00', NULL, '0b3e97c1-ec72-44c7-8503-ba49b14d6d5e'),
	('00000000-0000-0000-0000-000000000000', 70, 'yz3e4roubw6u', 'c27c1ff6-b521-4b4c-ad89-394e50df7909', false, '2026-07-24 15:58:03.550373+00', '2026-07-24 15:58:03.550373+00', NULL, 'ffe0a253-30c3-41af-92b7-54caa184f0bb'),
	('00000000-0000-0000-0000-000000000000', 71, 't5pzcgyyxgsh', 'c27c1ff6-b521-4b4c-ad89-394e50df7909', false, '2026-07-24 15:58:27.82118+00', '2026-07-24 15:58:27.82118+00', NULL, '9324fd5e-a117-41e2-8870-ce45873276b7'),
	('00000000-0000-0000-0000-000000000000', 72, '3pmpwrhecorb', 'c27c1ff6-b521-4b4c-ad89-394e50df7909', false, '2026-07-24 16:00:26.814539+00', '2026-07-24 16:00:26.814539+00', NULL, '1fedf849-46e6-4e8e-a427-bb78f8dafe26'),
	('00000000-0000-0000-0000-000000000000', 73, 'zgtjw5ku2xbw', '80c17091-eabf-4c5d-aec2-f440f9045d67', false, '2026-07-24 16:06:12.807804+00', '2026-07-24 16:06:12.807804+00', NULL, '1684dcad-cb47-4a58-9a1d-e02eb49495b1'),
	('00000000-0000-0000-0000-000000000000', 74, 'f54l4ygodyqd', '80c17091-eabf-4c5d-aec2-f440f9045d67', false, '2026-07-24 16:06:36.663578+00', '2026-07-24 16:06:36.663578+00', NULL, 'c2769693-703f-4d47-9e81-451e9d58edba'),
	('00000000-0000-0000-0000-000000000000', 75, 'rfvnxroyfepr', '80c17091-eabf-4c5d-aec2-f440f9045d67', false, '2026-07-24 16:07:03.037681+00', '2026-07-24 16:07:03.037681+00', NULL, '756a25d2-3761-4254-bdb4-59293c08f75c'),
	('00000000-0000-0000-0000-000000000000', 76, 'wz6vzdddkllo', '7dc3ea3c-c21f-4d81-83c8-8df394348152', false, '2026-07-24 16:27:17.585917+00', '2026-07-24 16:27:17.585917+00', NULL, 'ecd787b0-06fe-43a6-a9c7-7601ec8ff1eb'),
	('00000000-0000-0000-0000-000000000000', 77, 'remi7benc2o3', '7dc3ea3c-c21f-4d81-83c8-8df394348152', false, '2026-07-24 16:27:47.217186+00', '2026-07-24 16:27:47.217186+00', NULL, 'a6af6ca4-66ea-4058-b8a6-b773e2f151c8'),
	('00000000-0000-0000-0000-000000000000', 78, 'rijtzfv2ygxy', '7dc3ea3c-c21f-4d81-83c8-8df394348152', false, '2026-07-24 16:28:36.756348+00', '2026-07-24 16:28:36.756348+00', NULL, '2f86983e-69ee-4b3d-845b-5c179be3bd56'),
	('00000000-0000-0000-0000-000000000000', 197, 'vrxgyev672rn', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-29 13:02:50.775836+00', '2026-07-30 09:33:13.124152+00', 'lk2quibvfcck', '1448626c-ce9e-49d6-93d9-eff5ca3f92e3'),
	('00000000-0000-0000-0000-000000000000', 81, 'hw7hsnwumqvt', '100d13b9-906a-43b0-a42c-e77d6417bbf8', false, '2026-07-24 16:49:57.672919+00', '2026-07-24 16:49:57.672919+00', NULL, '9a83465c-10a8-4d49-8ae4-2e05c80b0daa'),
	('00000000-0000-0000-0000-000000000000', 82, 'u4rvpduizren', '100d13b9-906a-43b0-a42c-e77d6417bbf8', false, '2026-07-24 16:50:29.538704+00', '2026-07-24 16:50:29.538704+00', NULL, '4c982417-c661-46ec-991f-ba4beb7c3cb0'),
	('00000000-0000-0000-0000-000000000000', 83, 'rysrndlsnven', '100d13b9-906a-43b0-a42c-e77d6417bbf8', false, '2026-07-24 16:51:29.446207+00', '2026-07-24 16:51:29.446207+00', NULL, '6a4929e7-dc37-47b0-942a-5a7128c9e0ec'),
	('00000000-0000-0000-0000-000000000000', 84, 'n2psdq4zj6zn', '100d13b9-906a-43b0-a42c-e77d6417bbf8', false, '2026-07-24 16:52:02.402556+00', '2026-07-24 16:52:02.402556+00', NULL, '85e810c1-9e19-49a7-8591-7ddf897c3359'),
	('00000000-0000-0000-0000-000000000000', 85, 'c42t7dib3qov', '100d13b9-906a-43b0-a42c-e77d6417bbf8', false, '2026-07-24 16:52:46.168178+00', '2026-07-24 16:52:46.168178+00', NULL, '3fb8b24a-357b-4275-bdf9-4cb642daa794'),
	('00000000-0000-0000-0000-000000000000', 86, '2w6toey6qhvy', '100d13b9-906a-43b0-a42c-e77d6417bbf8', false, '2026-07-24 16:55:41.492763+00', '2026-07-24 16:55:41.492763+00', NULL, '2d70fac6-bd3b-472a-8477-dd5d773fa757'),
	('00000000-0000-0000-0000-000000000000', 87, 'fzub64icwqxc', '57274be8-c311-497f-be9f-c608ed3e3580', false, '2026-07-24 17:09:49.186359+00', '2026-07-24 17:09:49.186359+00', NULL, 'c5aa687e-2d3d-47be-abd4-9f9100979b6d'),
	('00000000-0000-0000-0000-000000000000', 88, 'virm3afltdfh', '57274be8-c311-497f-be9f-c608ed3e3580', false, '2026-07-24 17:10:18.352498+00', '2026-07-24 17:10:18.352498+00', NULL, 'b3670e02-eb71-472c-9c88-0989f48bd9fb'),
	('00000000-0000-0000-0000-000000000000', 89, '6ggmqhavpcty', '57274be8-c311-497f-be9f-c608ed3e3580', false, '2026-07-24 17:11:01.318856+00', '2026-07-24 17:11:01.318856+00', NULL, '3a7594dd-6f22-453c-bdbf-dcce0db0664b'),
	('00000000-0000-0000-0000-000000000000', 195, 'jbaj542ajqiv', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-29 09:53:48.59765+00', '2026-07-30 09:50:48.198254+00', 'a27r2lmvyqcp', 'f08f68ad-47ee-4d57-a2a1-a36cb797907a'),
	('00000000-0000-0000-0000-000000000000', 199, 'kzxuqoawkplp', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', false, '2026-07-30 09:50:48.204944+00', '2026-07-30 09:50:48.204944+00', 'jbaj542ajqiv', 'f08f68ad-47ee-4d57-a2a1-a36cb797907a'),
	('00000000-0000-0000-0000-000000000000', 91, 'h3roy576ppii', '30e037db-f8dd-4bec-8e3f-e71b964cf8de', false, '2026-07-24 17:35:17.183809+00', '2026-07-24 17:35:17.183809+00', NULL, 'c2af7286-eca9-476d-8a9a-ebfcd55e3f54'),
	('00000000-0000-0000-0000-000000000000', 92, 'vircxum3khv6', '30e037db-f8dd-4bec-8e3f-e71b964cf8de', false, '2026-07-24 17:35:45.943583+00', '2026-07-24 17:35:45.943583+00', NULL, 'a6942cb6-1375-4a2d-9485-ed032ab51714'),
	('00000000-0000-0000-0000-000000000000', 93, 'udyvdoiowaqo', '30e037db-f8dd-4bec-8e3f-e71b964cf8de', false, '2026-07-24 17:36:19.4435+00', '2026-07-24 17:36:19.4435+00', NULL, 'e4c5be1d-19cd-4661-ab93-a9ba91343475'),
	('00000000-0000-0000-0000-000000000000', 193, '53ox3uwjz6rw', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-29 05:52:00.063276+00', '2026-07-30 17:20:09.380425+00', 'h2gsvqh2hkeu', '541774a6-99c9-45dd-9417-f2f268c8d05e'),
	('00000000-0000-0000-0000-000000000000', 201, 'rh2qj6adueov', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-30 15:31:08.464754+00', '2026-07-31 01:19:05.424957+00', 'jt3hnr6qep5k', 'faf72bdd-ce06-4e03-877d-e3d60c62a2f6'),
	('00000000-0000-0000-0000-000000000000', 203, '26ezp4pff2dl', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', false, '2026-07-31 01:19:05.445774+00', '2026-07-31 01:19:05.445774+00', 'rh2qj6adueov', 'faf72bdd-ce06-4e03-877d-e3d60c62a2f6'),
	('00000000-0000-0000-0000-000000000000', 96, 'bdrhjcrefrrx', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', false, '2026-07-24 18:25:39.809341+00', '2026-07-24 18:25:39.809341+00', NULL, '218643b2-c620-4ed6-8b71-23d012c3eb0c'),
	('00000000-0000-0000-0000-000000000000', 97, '34mj457g4fxb', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', false, '2026-07-24 18:26:48.78752+00', '2026-07-24 18:26:48.78752+00', NULL, 'c626f7fb-e25d-4939-bedd-a5ff3059b522'),
	('00000000-0000-0000-0000-000000000000', 98, '5rhjuvixtw7i', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', false, '2026-07-24 18:27:42.087154+00', '2026-07-24 18:27:42.087154+00', NULL, '241e00ff-b319-4468-9c54-af55bea82d42'),
	('00000000-0000-0000-0000-000000000000', 99, '3didqgt4r33z', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', false, '2026-07-24 18:28:53.899635+00', '2026-07-24 18:28:53.899635+00', NULL, 'fb54c565-ef8d-48cb-8329-42e52f37f22d'),
	('00000000-0000-0000-0000-000000000000', 100, 'oedq3rtur5fm', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', false, '2026-07-24 18:29:57.377723+00', '2026-07-24 18:29:57.377723+00', NULL, '5f039536-4084-4887-a5fc-696b949236bf'),
	('00000000-0000-0000-0000-000000000000', 101, 'wo3chkdunp2t', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', false, '2026-07-24 18:31:05.052552+00', '2026-07-24 18:31:05.052552+00', NULL, '00946fac-9b34-412c-8dcb-17a60968a331'),
	('00000000-0000-0000-0000-000000000000', 102, 'e7wf5czvljv6', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', false, '2026-07-24 18:31:54.333212+00', '2026-07-24 18:31:54.333212+00', NULL, '03bb8771-a3c4-4ea9-a45d-440444670804'),
	('00000000-0000-0000-0000-000000000000', 103, 'fy4kxxiwha4u', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', false, '2026-07-24 18:32:47.640281+00', '2026-07-24 18:32:47.640281+00', NULL, 'fa7e2508-47c2-4e23-ab9c-e85ec6863072'),
	('00000000-0000-0000-0000-000000000000', 104, '2voeofhfk5t2', 'b867cd0a-1180-4fa4-8451-a93e71ea9819', false, '2026-07-24 18:33:22.682635+00', '2026-07-24 18:33:22.682635+00', NULL, '0617ff71-4b07-4ab7-bb32-d72d9a9a98dc'),
	('00000000-0000-0000-0000-000000000000', 174, '3mvt3zok4enu', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-27 13:41:46.843189+00', '2026-07-27 14:42:49.914518+00', 'hoxioakvmbsb', '9aeefa92-4ffa-42e0-ad2b-09a2f1b4508e'),
	('00000000-0000-0000-0000-000000000000', 176, 'ch5ei3jmwax5', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-27 17:51:52.995305+00', '2026-07-27 18:57:19.294888+00', NULL, 'faf72bdd-ce06-4e03-877d-e3d60c62a2f6'),
	('00000000-0000-0000-0000-000000000000', 178, '6c337rj3cnyi', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', false, '2026-07-27 19:23:57.002127+00', '2026-07-27 19:23:57.002127+00', NULL, 'c0f2fe98-7a44-479e-b3c0-69d44369df80'),
	('00000000-0000-0000-0000-000000000000', 180, 'v6yf2xw76ubm', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-28 03:04:39.300437+00', '2026-07-28 10:44:44.619726+00', NULL, '1448626c-ce9e-49d6-93d9-eff5ca3f92e3'),
	('00000000-0000-0000-0000-000000000000', 172, '326iy67mhvue', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-27 10:57:16.549464+00', '2026-07-28 11:01:38.971145+00', NULL, '541774a6-99c9-45dd-9417-f2f268c8d05e'),
	('00000000-0000-0000-0000-000000000000', 182, '4sexy6dhmvo5', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-28 11:01:38.982748+00', '2026-07-28 12:00:08.992672+00', '326iy67mhvue', '541774a6-99c9-45dd-9417-f2f268c8d05e'),
	('00000000-0000-0000-0000-000000000000', 184, 'oyufrio75loq', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-28 13:29:25.438868+00', '2026-07-28 15:01:41.891628+00', '7tcwwxx55ah7', '1448626c-ce9e-49d6-93d9-eff5ca3f92e3'),
	('00000000-0000-0000-0000-000000000000', 187, '3m4zf4vhypqu', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-28 16:03:14.87528+00', '2026-07-29 02:39:21.132185+00', 'wgyhuvzr6kdi', '1448626c-ce9e-49d6-93d9-eff5ca3f92e3'),
	('00000000-0000-0000-0000-000000000000', 189, 'vohtqvqdzd6a', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-29 00:55:28.387374+00', '2026-07-29 04:36:57.802819+00', 'ie2lcnjeutjx', '541774a6-99c9-45dd-9417-f2f268c8d05e'),
	('00000000-0000-0000-0000-000000000000', 191, 'h2gsvqh2hkeu', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', true, '2026-07-29 04:36:57.820196+00', '2026-07-29 05:52:00.045789+00', 'vohtqvqdzd6a', '541774a6-99c9-45dd-9417-f2f268c8d05e');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."organizations" ("id", "name", "slug", "status", "created_at") VALUES
	('bf496ef5-ee27-429d-99d5-770d8b917c66', 'Salam Motors', 'salam-motors', 'active', '2026-07-27 07:27:14.47553+00');


--
-- Data for Name: compliance_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."compliance_policies" ("id", "user_id", "name", "description", "category", "rule_type", "params", "severity", "is_active", "created_at", "updated_at", "resolution_mode", "deleted_at", "org_id") VALUES
	('6947b25b-2c4a-4e64-ae57-00abefff61a6', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'RC book required', 'Every vehicle must have its Registration Certificate attached.', 'document', 'document_required', '{"document_type": "RC book"}', 'Critical', true, '2026-07-25 13:10:18.491584+00', '2026-07-25 13:10:18.491584+00', 'manual', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('92bd39b7-816f-4ab4-8289-35509a0a1379', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'Insurance required', 'Every vehicle must have proof of insurance attached.', 'document', 'document_required', '{"document_type": "Insurance"}', 'High', true, '2026-07-25 13:10:18.491584+00', '2026-07-25 13:10:18.491584+00', 'manual', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('7a79030b-28f6-4c4f-93a7-f78350545d83', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'PUC required', 'Every vehicle must have a valid PUC certificate attached.', 'document', 'document_required', '{"document_type": "PUC"}', 'Warning', true, '2026-07-25 13:10:18.491584+00', '2026-07-25 13:10:18.491584+00', 'manual', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'Seller identity required', 'Every vehicle must have the seller''s ID proof attached.', 'document', 'document_required', '{"document_type": "Seller identity"}', 'Warning', true, '2026-07-25 13:10:18.491584+00', '2026-07-25 13:10:18.491584+00', 'manual', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('99efc683-f780-4637-8a15-58b757a6df25', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'Purchase payments need proof', 'Every purchase payment must have a supporting screenshot or receipt.', 'financial_evidence', 'evidence_required', '{"entity": "purchase_payment"}', 'High', true, '2026-07-25 13:10:18.491584+00', '2026-07-25 13:10:18.491584+00', 'manual', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('1d3ad61a-d274-4dea-9e06-c42aa677e34b', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'Expenses need bills', 'Every submitted or approved expense must have a bill or receipt attached.', 'financial_evidence', 'evidence_required', '{"entity": "expense"}', 'Warning', true, '2026-07-25 13:10:18.491584+00', '2026-07-25 13:10:18.491584+00', 'manual', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('a31a826c-022c-491d-8294-32bde73ab8f3', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'Vehicle investments need proof', 'Every investment tied to a specific vehicle must have supporting proof attached.', 'financial_evidence', 'evidence_required', '{"entity": "investment"}', 'Warning', true, '2026-07-25 13:10:18.491584+00', '2026-07-25 13:10:18.491584+00', 'manual', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('583a19b1-ab68-47a4-9de4-068fb5df8ddd', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'Purchase payments must match price', 'Total purchase payments must reconcile exactly to the agreed price plus broker commission and other fees.', 'financial_reconciliation', 'amount_reconciliation', '{"target": "purchase_payments_vs_purchase_price", "tolerance": 0.01}', 'Critical', true, '2026-07-25 13:10:18.491584+00', '2026-07-25 13:10:18.491584+00', 'manual', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vehicles" ("id", "stock_number", "registration_number", "category", "manufacturer", "brand", "model", "variant", "fuel_type", "colour", "manufacture_year", "registration_date", "chassis_number", "engine_number", "odometer", "owner_count", "registration_city", "registration_state", "current_location", "current_status", "asking_price", "minimum_price", "onboarded_at", "sold_at", "notes", "created_at", "updated_at", "user_id", "deleted_at", "org_id") VALUES
	('f97c7f5a-7970-49f2-92e0-a7bd5376460b', 'BIKE-2026-000014', 'Tn49cs7281', 'Motorcycle', 'Tvs', 'Tvs', 'Appachi', NULL, 'Petrol', 'Blue', 2024, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, 'PURCHASED', NULL, NULL, '2026-07-30 14:19:47.49754+00', NULL, NULL, '2026-07-30 14:19:47.49754+00', '2026-07-30 14:19:47.49754+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'BIKE-2026-000004', 'tn65bt7605', 'Scooter', 'yamaha', 'yamaha', 'ray', NULL, 'Petrol', 'black', 2024, NULL, NULL, NULL, NULL, 1, NULL, NULL, 'Central Yard', 'PURCHASED', 65000.00, 60000.00, '2026-07-26 04:15:35.382759+00', NULL, NULL, '2026-07-26 04:15:35.382759+00', '2026-07-26 04:25:35.957+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('e874930a-e059-4084-afe2-dba5fce82128', 'BIKE-2026-000005', 'TN60BW5457', 'Scooter', 'hero', 'XXX', 'pleasure', 'XXX', 'Petrol', 'GREY', 2024, NULL, '11111', '11111', 1111, 1, 'THENI', 'TAMILNADU', 'THENI', 'PURCHASED', 56000.00, 53000.00, '2026-07-26 07:10:12.704516+00', NULL, NULL, '2026-07-26 07:10:12.704516+00', '2026-07-26 07:10:12.704516+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('6c542e70-ab80-474e-bc1d-dffb1c448c76', 'BIKE-2026-000006', 'TN72CU6790', 'Motorcycle', 'HONDA', 'HONDA', 'SHINE125', NULL, 'Petrol', 'BLACK', 2023, NULL, NULL, NULL, NULL, 1, NULL, NULL, 'Central Yard', 'PURCHASED', NULL, NULL, '2026-07-26 07:25:15.770256+00', NULL, NULL, '2026-07-26 07:25:15.770256+00', '2026-07-26 07:25:15.770256+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'BIKE-2026-000008', 'TN63BR7842', 'Scooter', 'YAMAHA', 'YAMAHA', 'FASCINO', NULL, 'Petrol', 'GREY', 2023, NULL, NULL, NULL, NULL, 1, NULL, NULL, 'Central Yard', 'PURCHASED', NULL, NULL, '2026-07-26 07:30:27.135871+00', NULL, NULL, '2026-07-26 07:30:27.135871+00', '2026-07-26 07:30:27.135871+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('120a14f0-2e31-4822-935c-443cd5179770', 'BIKE-2026-000009', 'TN49CV2538', 'Motorcycle', 'HERO', 'HERO', 'SPLENDOUR', NULL, 'Petrol', 'BLACK', 2022, NULL, NULL, NULL, NULL, 1, NULL, NULL, 'Central Yard', 'PURCHASED', NULL, NULL, '2026-07-26 07:32:29.123434+00', NULL, NULL, '2026-07-26 07:32:29.123434+00', '2026-07-26 07:32:29.123434+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('546e52eb-5e44-464f-8de8-ac244fdb2f92', 'BIKE-2026-000010', 'TN59DD5216', 'Motorcycle', 'HERO', 'HERO', 'PASSION PLUS', NULL, 'Petrol', 'BLACK', 2025, NULL, NULL, NULL, NULL, 1, NULL, NULL, 'Central Yard', 'PURCHASED', NULL, NULL, '2026-07-26 07:33:42.99924+00', NULL, NULL, '2026-07-26 07:33:42.99924+00', '2026-07-26 07:33:42.99924+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('8ae3388d-5818-4367-971a-78298eb10370', 'BIKE-2026-000011', 'TN50AM7936', 'Scooter', 'HONDA', 'HONDA', 'DIO', NULL, 'Petrol', 'GREY', 2024, NULL, NULL, NULL, NULL, 1, NULL, NULL, 'Central Yard', 'PURCHASED', NULL, NULL, '2026-07-26 07:35:46.601959+00', NULL, NULL, '2026-07-26 07:35:46.601959+00', '2026-07-26 07:35:46.601959+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('129c1c35-e0e2-41fa-977f-35161dff381c', 'BIKE-2026-000012', 'TN68AM0277', 'Motorcycle', 'HERO', 'HERO', 'PASSSION PLUS', NULL, 'Petrol', 'BLACK', 2023, NULL, NULL, NULL, NULL, 1, NULL, NULL, 'Central Yard', 'PURCHASED', NULL, NULL, '2026-07-26 07:36:45.350689+00', NULL, NULL, '2026-07-26 07:36:45.350689+00', '2026-07-26 11:32:06.043+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'BIKE-2026-000007', 'TN60BW9329', 'Motorcycle', 'TVS', 'TVS', 'APPACHI', NULL, 'Petrol', 'BLACK', 2024, NULL, NULL, NULL, NULL, 1, NULL, NULL, 'Central Yard', 'PURCHASED', NULL, NULL, '2026-07-26 07:27:30.169047+00', NULL, NULL, '2026-07-26 07:27:30.169047+00', '2026-07-27 19:24:07.008+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('e215728a-e4b2-4bcc-b8f9-96ebc7f460b1', 'BIKE-2026-000013', 'Tn64AB7639', 'Scooter', 'Yamaha', 'Yamaha', 'Fascino', NULL, 'Petrol', 'WHITE', 2024, NULL, NULL, NULL, NULL, 1, NULL, NULL, NULL, 'PURCHASED', NULL, NULL, '2026-07-29 06:18:31.052238+00', NULL, NULL, '2026-07-29 06:18:31.052238+00', '2026-07-29 06:18:31.052238+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."alerts" ("id", "vehicle_id", "alert_type", "severity", "title", "message", "days_in_inventory", "status", "assigned_to", "acknowledged_at", "resolved_at", "created_at", "user_id", "policy_id", "org_id") VALUES
	('62ec5109-b6a1-4e9a-9c8b-9d0a9be0c384', 'e215728a-e4b2-4bcc-b8f9-96ebc7f460b1', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-29 06:18:33.810102+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('57ee49f2-91bc-4a3a-8a7c-e67ba2434156', 'e215728a-e4b2-4bcc-b8f9-96ebc7f460b1', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-29 06:18:34.295896+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('2e8784b4-9b26-4145-9a2e-beb8c3789e17', 'f97c7f5a-7970-49f2-92e0-a7bd5376460b', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-30 14:19:50.028699+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('ee8e386f-9a16-4cad-ba5b-75c18fd6983b', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Compliance', 'Warning', 'Expenses need bills', 'Compliance policy "Expenses need bills" (financial evidence) is currently violated.', NULL, 'Resolved', NULL, NULL, '2026-07-31 01:28:10.588+00', '2026-07-27 17:54:04.867643+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '1d3ad61a-d274-4dea-9e06-c42aa677e34b', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('1b1e6c0d-91fe-4b7d-9523-228bd2719b09', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 04:15:36.885709+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('8496658f-a977-4029-a44f-e569a29ad20f', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 04:15:37.044436+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('61a73f73-1e2b-4038-9c94-d9a3f971f641', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 04:15:37.20935+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('098d1f39-4169-44d1-828b-af7dcab3b28c', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 04:15:37.368846+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('b9efbd0a-393b-480a-aeaf-7f595beafccf', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 04:15:37.542889+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('41bc1333-f1ff-4736-bd93-a586604604f6', 'e874930a-e059-4084-afe2-dba5fce82128', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:10:18.144203+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('09723ece-2c65-4784-bacc-0400069ed069', 'e874930a-e059-4084-afe2-dba5fce82128', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:10:18.306419+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('c7b3eb45-e12f-492e-bf42-0d29145ddba6', 'e874930a-e059-4084-afe2-dba5fce82128', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:10:18.466958+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('8325f292-f5c6-4195-b9fe-bbfa872b1c5a', 'e874930a-e059-4084-afe2-dba5fce82128', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:10:18.616402+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('422d64f8-e22c-494c-8487-60807d44755a', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Compliance', 'Warning', 'Expenses need bills', 'Compliance policy "Expenses need bills" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-27 18:01:28.268613+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '1d3ad61a-d274-4dea-9e06-c42aa677e34b', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('ed6b7a74-5612-469a-a2b7-f04189d46303', 'e215728a-e4b2-4bcc-b8f9-96ebc7f460b1', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-29 06:18:33.972055+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('c94b6909-bcff-460a-a8d7-ad6669d0ca2d', 'f97c7f5a-7970-49f2-92e0-a7bd5376460b', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-30 14:19:49.289546+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('71f08d3c-ab9e-4412-ab49-db37b45a10a0', 'f97c7f5a-7970-49f2-92e0-a7bd5376460b', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-30 14:19:49.606888+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('1e126730-422a-4b90-9e17-57fa7c55ae1d', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'Compliance', 'Warning', 'Expenses need bills', 'Compliance policy "Expenses need bills" (financial evidence) is currently violated.', NULL, 'Resolved', NULL, NULL, '2026-07-30 15:03:59.721+00', '2026-07-30 14:21:10.104908+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '1d3ad61a-d274-4dea-9e06-c42aa677e34b', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('b6382c0e-a29d-4640-a57d-8cdebf382b9b', 'e874930a-e059-4084-afe2-dba5fce82128', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:10:18.779299+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('b778627b-533a-4e68-9bad-5dd944a4b31d', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:25:17.608361+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('7c9dd9c6-97fb-4b31-ab48-5ba952195733', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:25:17.766667+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('2fc67bb0-566c-4bad-8e07-84f38803310a', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:27:32.578632+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('2d76055b-412d-481e-9c2e-650197d2ee7c', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:30:28.438838+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('be5d106c-06c0-430a-80f2-a2e48b0e6033', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:25:17.91535+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('4adf5801-a0bb-4f9a-9492-d6d41fff9101', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:25:18.074294+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('6aae546c-dd08-4330-9201-56c58ff40eca', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:25:18.228738+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('01713103-f4df-48ed-b210-37917475b651', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:27:31.817802+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('76ce83a2-2833-4620-a8bf-f272f46d85dd', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:27:32.00187+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('42aef2dd-37e5-4e86-aa4e-108ecff0e9a2', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:27:32.186211+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('52339bc8-3d08-4558-8573-1b7a05ddd4ec', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:27:32.358137+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('1d686d25-3425-4259-9d57-26f7b651a695', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:30:28.593803+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('f906833b-08f7-4082-86b5-0993d6daa4ad', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:30:28.744243+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('7ea5455f-e008-4299-9d9a-f5c21a9f62b3', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:30:28.904669+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('85b26da7-29ce-4199-a312-be918de60314', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:30:29.054452+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('b55e842a-f15b-4174-8f8c-31936d78597a', '120a14f0-2e31-4822-935c-443cd5179770', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:32:30.832448+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('5e81af7e-a726-42d2-94be-b4ad676c3334', '120a14f0-2e31-4822-935c-443cd5179770', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:32:31.008839+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('231ad708-e5a1-4464-b23b-23256610ab5e', '120a14f0-2e31-4822-935c-443cd5179770', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:32:31.175021+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('d37840df-25e7-4a6c-979c-4734dc83bb58', '120a14f0-2e31-4822-935c-443cd5179770', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:32:31.338994+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('0c46abd5-e1fd-47df-b6d1-378873ede65a', '120a14f0-2e31-4822-935c-443cd5179770', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:32:31.498145+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('f33d4aa5-2094-4da7-9be8-9bb95a0792c1', '546e52eb-5e44-464f-8de8-ac244fdb2f92', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:33:44.777019+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('1a7338af-3362-4552-b3e9-a272c88352a3', '546e52eb-5e44-464f-8de8-ac244fdb2f92', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:33:44.93584+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('726e5637-8bf5-44e6-91bf-22b2f70689e0', '546e52eb-5e44-464f-8de8-ac244fdb2f92', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:33:45.094362+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('a81e5e17-18a2-4912-99c0-e6ed57cbae83', '546e52eb-5e44-464f-8de8-ac244fdb2f92', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:33:45.251144+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('12bc84ea-ba1a-4b18-b175-4c3d9d229238', '546e52eb-5e44-464f-8de8-ac244fdb2f92', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:33:45.405525+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('d6946d27-8fb7-480e-9f15-12363bad947c', '8ae3388d-5818-4367-971a-78298eb10370', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:35:48.098728+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('6b55cc4b-57d2-463e-825d-8ed164a85683', '8ae3388d-5818-4367-971a-78298eb10370', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:35:48.260294+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('5df09a00-0634-4961-bfbb-30c74ac1d460', '8ae3388d-5818-4367-971a-78298eb10370', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:35:48.421632+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('bac17c6e-1266-4644-891f-09b06d969ed9', '8ae3388d-5818-4367-971a-78298eb10370', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:35:48.584792+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('2146ab62-b5d1-4774-8c96-e695e7dd20fb', '8ae3388d-5818-4367-971a-78298eb10370', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:35:48.738696+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('5529b6cb-fece-4d88-96d3-6efc440b8334', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:36:46.760856+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('0677d9b0-516c-42fc-85fe-f922d28cee00', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:36:46.924334+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('7daba390-0210-43c1-bb3d-b9785e0b67a8', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Compliance', 'Warning', 'PUC required', 'Compliance policy "PUC required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:36:47.08412+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7a79030b-28f6-4c4f-93a7-f78350545d83', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('ef0d812f-2945-4812-9010-080eb5312692', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 07:36:47.245507+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('2db75e89-6988-43a7-8a3a-91f489d53020', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Resolved', NULL, NULL, '2026-07-26 07:39:46.859+00', '2026-07-26 07:36:47.402991+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('dd110e0b-a991-49af-963c-3d9ea4982334', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Compliance', 'High', 'Purchase payments need proof', 'Compliance policy "Purchase payments need proof" (financial evidence) is currently violated.', NULL, 'Acknowledged', NULL, '2026-07-26 07:39:58.273+00', NULL, '2026-07-26 07:39:47.713667+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '99efc683-f780-4637-8a15-58b757a6df25', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('7fa55d76-a19c-4c1d-ac0b-ccea81f98b08', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Compliance', 'Warning', 'Expenses need bills', 'Compliance policy "Expenses need bills" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 11:14:16.578548+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '1d3ad61a-d274-4dea-9e06-c42aa677e34b', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('504079a8-512c-4df9-b95b-5f362b9bd789', '120a14f0-2e31-4822-935c-443cd5179770', 'Compliance', 'Warning', 'Expenses need bills', 'Compliance policy "Expenses need bills" (financial evidence) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-26 11:16:36.091474+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '1d3ad61a-d274-4dea-9e06-c42aa677e34b', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('b0490016-3517-4581-b8c2-3a2a1097c1d1', 'e215728a-e4b2-4bcc-b8f9-96ebc7f460b1', 'Compliance', 'Critical', 'RC book required', 'Compliance policy "RC book required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-29 06:18:33.634502+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '6947b25b-2c4a-4e64-ae57-00abefff61a6', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('be151012-8ddd-431f-8853-08c71b7b89f5', 'e215728a-e4b2-4bcc-b8f9-96ebc7f460b1', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-29 06:18:34.125227+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('237d5d66-351c-4419-bd56-051e2bcf11a4', 'f97c7f5a-7970-49f2-92e0-a7bd5376460b', 'Compliance', 'High', 'Insurance required', 'Compliance policy "Insurance required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-30 14:19:49.451978+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '92bd39b7-816f-4ab4-8289-35509a0a1379', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('48c2c2fb-e70c-4092-93f7-7c6328d53c73', 'f97c7f5a-7970-49f2-92e0-a7bd5376460b', 'Compliance', 'Warning', 'Seller identity required', 'Compliance policy "Seller identity required" (document) is currently violated.', NULL, 'Open', NULL, NULL, NULL, '2026-07-30 14:19:49.858045+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'ec7b8e5b-6467-46f0-a1b6-fa1d27a4a590', 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."app_settings" ("estimated_profit_margin_low_pct", "estimated_profit_margin_high_pct", "updated_at", "updated_by", "org_id") VALUES
	(10, 30, '2026-07-26 13:45:19.028539+00', 'salam@gmail.com', 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: assistant_capabilities; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."assistant_capabilities" ("action_type", "description", "allowed_roles", "allow_partner", "risk_level", "requires_confirmation", "requires_step_up", "enabled", "created_at", "updated_at") VALUES
	('vehicle.create_with_purchase', 'Create a vehicle, purchase, initial payment, and optional listing atomically', '{owner,manager}', false, 'high', true, false, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('vehicle.complete_sale', 'Complete a sale and calculate partner distributions atomically', '{owner}', false, 'critical', true, false, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('vehicle.archive', 'Archive an eligible vehicle', '{owner,manager}', false, 'critical', true, false, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('listing.publish', 'Publish or unpublish a public vehicle passport', '{owner,manager,sales_executive}', false, 'high', true, false, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('expense.record', 'Create or change a vehicle expense', '{owner,manager,accountant}', false, 'medium', true, false, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('investment.record', 'Record partner capital', '{owner,accountant}', false, 'high', true, false, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('settlement.record', 'Record a partner settlement ledger payment', '{owner,accountant}', false, 'critical', true, false, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('inspection.record', 'Create or update an inspection', '{owner,manager,mechanic_inspector}', false, 'medium', true, false, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('alert.acknowledge', 'Acknowledge an operational alert', '{owner,manager,sales_executive,accountant,mechanic_inspector}', false, 'low', false, false, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('policy.modify', 'Create or change a compliance policy', '{owner,manager}', false, 'high', true, false, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('team.invite', 'Invite a staff member', '{owner}', false, 'high', true, true, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('team.change_role', 'Change a staff member role', '{owner}', false, 'critical', true, true, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('team.suspend', 'Suspend or restore staff access', '{owner}', false, 'critical', true, true, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00'),
	('partner.portal_access', 'Grant or revoke partner portal access', '{owner}', false, 'high', true, true, true, '2026-07-28 02:03:05.810494+00', '2026-07-28 02:03:05.810494+00');


--
-- Data for Name: partners; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."partners" ("id", "name", "mobile", "email", "default_profit_share_pct", "joining_date", "status", "notes", "created_at", "user_id", "deleted_at", "org_id", "auth_user_id") VALUES
	('e8c19c47-0530-4fd8-9245-7f6913194f05', 'Salam Buhari', '9486878910', 'sharukhsalam1@gmail.com', 60.00, '2026-07-25', 'active', NULL, '2026-07-25 02:21:36.200925+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66', NULL),
	('d2a86c7e-78d8-4a94-96ce-0cf2114ddf37', 'Jahir Hussain', '6385678384', 'kjahir@yahoo.com', 30.00, '2026-07-25', 'active', NULL, '2026-07-25 02:22:04.940118+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66', NULL),
	('2caf498f-3793-4a18-be39-720023e60698', 'Company', NULL, NULL, 10.00, '2026-07-25', 'active', NULL, '2026-07-25 02:22:19.429769+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66', NULL);


--
-- Data for Name: assistant_conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."assistant_conversations" ("id", "org_id", "created_by_user_id", "partner_id", "title", "locale", "status", "metadata", "last_message_at", "created_at", "updated_at") VALUES
	('a4744fc3-e9ed-43a4-8cf7-b544d3b1a846', 'bf496ef5-ee27-429d-99d5-770d8b917c66', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'Show vehicles older than 45 days', 'en-IN', 'active', '{}', '2026-07-28 02:40:49.828+00', '2026-07-28 02:40:14.922731+00', '2026-07-28 02:40:49.828+00');


--
-- Data for Name: assistant_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."assistant_messages" ("id", "org_id", "conversation_id", "role", "content", "language", "created_by_user_id", "client_message_id", "model", "safety_labels", "created_at") VALUES
	('4d570871-2a57-46fc-b4c2-53c32049711d', 'bf496ef5-ee27-429d-99d5-770d8b917c66', 'a4744fc3-e9ed-43a4-8cf7-b544d3b1a846', 'user', '{"text": "Show vehicles older than 45 days", "surface": "desktop"}', 'en-IN', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, NULL, '{}', '2026-07-28 02:40:15.259859+00'),
	('830c93d9-8dfa-4905-ae78-0f6e362ce5fd', 'bf496ef5-ee27-429d-99d5-770d8b917c66', 'a4744fc3-e9ed-43a4-8cf7-b544d3b1a846', 'assistant', '{"text": "There are no currently unsold vehicles older than 45 days in stock.", "tone": "info", "block_types": ["empty_state"], "source_count": 0, "schema_version": "1.0"}', 'en-IN', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'gpt-5.6-terra', '{}', '2026-07-28 02:40:22.425321+00'),
	('7deabc46-5db2-4337-8caf-92b47b13dc9a', 'bf496ef5-ee27-429d-99d5-770d8b917c66', 'a4744fc3-e9ed-43a4-8cf7-b544d3b1a846', 'user', '{"text": "Show all current inventory", "surface": "desktop"}', 'en-IN', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, NULL, '{}', '2026-07-28 02:40:31.300587+00'),
	('8a719c1d-4f3a-4387-bfcb-ed345dd537c8', 'bf496ef5-ee27-429d-99d5-770d8b917c66', 'a4744fc3-e9ed-43a4-8cf7-b544d3b1a846', 'assistant', '{"text": "You currently have 9 vehicles in inventory. All are in PURCHASED status and have been in stock for 1 day; 2 have asking prices set, while 7 still need pricing.", "tone": "info", "block_types": ["metric_grid", "vehicle_collection"], "source_count": 9, "schema_version": "1.0"}', 'en-IN', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'gpt-5.6-terra', '{}', '2026-07-28 02:40:49.779965+00');


--
-- Data for Name: assistant_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."assistant_runs" ("id", "org_id", "conversation_id", "requested_by_user_id", "input_message_id", "output_message_id", "status", "model", "trace_id", "idempotency_key", "started_at", "completed_at", "error_code", "error_message", "usage", "metadata", "created_at") VALUES
	('725a4d5d-ff70-47e7-927d-7a83542257fc', 'bf496ef5-ee27-429d-99d5-770d8b917c66', 'a4744fc3-e9ed-43a4-8cf7-b544d3b1a846', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '4d570871-2a57-46fc-b4c2-53c32049711d', '830c93d9-8dfa-4905-ae78-0f6e362ce5fd', 'completed', 'gpt-5.6-terra', 'c7387014-2e63-4b5f-a1ff-dd931f7842b0', NULL, '2026-07-28 02:40:15.543+00', '2026-07-28 02:40:22.564+00', NULL, NULL, '{"latency_ms": 6719, "input_tokens": 7964, "output_tokens": 235}', '{"page": "dashboard", "surface": "desktop"}', '2026-07-28 02:40:15.792874+00'),
	('c665e657-65a9-40c0-9e93-16553f3f6cf9', 'bf496ef5-ee27-429d-99d5-770d8b917c66', 'a4744fc3-e9ed-43a4-8cf7-b544d3b1a846', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '7deabc46-5db2-4337-8caf-92b47b13dc9a', '8a719c1d-4f3a-4387-bfcb-ed345dd537c8', 'completed', 'gpt-5.6-terra', 'c0fcb044-3da8-45c9-a6af-6654430ab785', NULL, '2026-07-28 02:40:31.581+00', '2026-07-28 02:40:49.919+00', NULL, NULL, '{"latency_ms": 18220, "input_tokens": 10061, "output_tokens": 2816}', '{"page": "dashboard", "surface": "desktop"}', '2026-07-28 02:40:31.65345+00');


--
-- Data for Name: assistant_tool_calls; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."assistant_tool_calls" ("id", "org_id", "conversation_id", "run_id", "requested_by_user_id", "tool_name", "status", "risk_level", "arguments_redacted", "result_redacted", "authorization_decision", "idempotency_key", "started_at", "completed_at", "error_code", "error_message", "created_at") VALUES
	('8e666ce2-469e-4909-8e7a-f8bea4649c05', 'bf496ef5-ee27-429d-99d5-770d8b917c66', 'a4744fc3-e9ed-43a4-8cf7-b544d3b1a846', '725a4d5d-ff70-47e7-927d-7a83542257fc', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'search_inventory', 'completed', 'low', '{"argument_hash": "ab670a4b74a8f72de2506bb7d9df6659497ee2eddc4fa933a9427c189d24f376"}', '{"ok": true, "truncated": false, "error_code": null, "entity_count": 0}', '{"role": "owner", "allowed": true, "principal_kind": "staff"}', NULL, '2026-07-28 02:40:19.189+00', '2026-07-28 02:40:19.285+00', NULL, NULL, '2026-07-28 02:40:19.349435+00'),
	('eecfb985-03ab-4a4e-b03a-a198ce370ade', 'bf496ef5-ee27-429d-99d5-770d8b917c66', 'a4744fc3-e9ed-43a4-8cf7-b544d3b1a846', 'c665e657-65a9-40c0-9e93-16553f3f6cf9', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'search_inventory', 'completed', 'low', '{"argument_hash": "c590588a8b155abe4a18066bb1c811d02553345a91dc0067afe651dee24c7428"}', '{"ok": true, "truncated": false, "error_code": null, "entity_count": 9}', '{"role": "owner", "allowed": true, "principal_kind": "staff"}', NULL, '2026-07-28 02:40:34.585+00', '2026-07-28 02:40:34.787+00', NULL, NULL, '2026-07-28 02:40:34.848058+00');


--
-- Data for Name: assistant_action_proposals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: assistant_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: assistant_idempotency_keys; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: assistant_security_audit_events; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."audit_logs" ("id", "entity_type", "entity_id", "action", "old_value", "new_value", "performed_by", "performed_at", "reason", "user_id", "org_id") VALUES
	('8a1dc19a-4449-4c89-8fcd-f4397d81f7db', 'vehicle', '2d7941b2-65dc-4e98-87b4-aa69a576d0d1', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-25 06:07:28.745142+00', 'Onboarded BIKE-2026-000003: HERO HERO PASSION PLUS', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('ecbfc106-a0c6-429a-81ad-752b42b73687', 'vehicle', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-26 04:15:36.254402+00', 'Onboarded BIKE-2026-000004: yamaha ray', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('eb87e39a-7c7d-495a-9589-30a9b89f0cb7', 'vehicle', 'e874930a-e059-4084-afe2-dba5fce82128', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-26 07:10:13.722496+00', 'Onboarded BIKE-2026-000005: hero pleasure', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('45990ea5-1de6-4864-891a-ce48621e1f57', 'vehicle', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-26 07:25:16.464981+00', 'Onboarded BIKE-2026-000006: HONDA SHINE125', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('45023da7-e37b-4136-ba95-96377591f2a1', 'vehicle', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-26 07:27:30.956489+00', 'Onboarded BIKE-2026-000007: TVS 2025', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('b6d0c6d1-62b3-4566-b83d-eea953f4cf33', 'vehicle', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-26 07:30:27.804476+00', 'Onboarded BIKE-2026-000008: YAMAHA FASCINO', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('a9cca285-52ee-4278-a694-dc6c2858328a', 'vehicle', '120a14f0-2e31-4822-935c-443cd5179770', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-26 07:32:29.838012+00', 'Onboarded BIKE-2026-000009: HERO SPLENDOUR', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('825fb0a7-d4df-465d-8cc1-f58950b59e8c', 'vehicle', '546e52eb-5e44-464f-8de8-ac244fdb2f92', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-26 07:33:43.688219+00', 'Onboarded BIKE-2026-000010: HERO PASSION PLUS', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('b7676997-56e2-4cbb-9248-cfa52a466e71', 'vehicle', '8ae3388d-5818-4367-971a-78298eb10370', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-26 07:35:47.285726+00', 'Onboarded BIKE-2026-000011: HONDA DIO', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('64484163-7495-4c5f-a035-f1b7899a08ea', 'vehicle', '129c1c35-e0e2-41fa-977f-35161dff381c', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-26 07:36:46.057275+00', 'Onboarded BIKE-2026-000012: HERO PASSSION PLUS', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('3fbfb2a7-182c-4cfe-9667-537cce80e6cd', 'expense', '5efa84be-b53f-4521-b540-72139f244ba2', 'deleted', NULL, NULL, 'salam@gmail.com', '2026-07-27 17:56:04.443732+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('bab9d47a-55f4-4f57-8771-626449b53001', 'vehicle', 'e215728a-e4b2-4bcc-b8f9-96ebc7f460b1', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-29 06:18:32.402885+00', 'Onboarded BIKE-2026-000013: Yamaha Fascino', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('7de846ea-ab40-488c-92f6-ae1ed591634a', 'vehicle', 'f97c7f5a-7970-49f2-92e0-a7bd5376460b', 'created', NULL, NULL, 'salam@gmail.com', '2026-07-30 14:19:48.343754+00', 'Onboarded BIKE-2026-000014: Tvs Appachi', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: listings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."listings" ("id", "vehicle_id", "asking_price", "minimum_price", "status", "listed_at", "description", "public_slug", "created_at", "user_id", "org_id") VALUES
	('3fe1d2cd-f45a-4e53-a5ad-9a588dd57e31', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 65000.00, 60000.00, 'Draft', '2026-07-26 04:25:37.905542+00', '2024 yamaha ray.  km.', 'yamaha-ray-2024-tn65bt7605-72a107', '2026-07-26 04:25:37.905542+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('b97555fa-8c07-4179-8e7c-ecd3367129ec', 'e874930a-e059-4084-afe2-dba5fce82128', 56000.00, 53000.00, 'Draft', '2026-07-26 07:10:13.519374+00', '2024 hero pleasure. 1111 km.', 'hero-pleasure-2024-tn60bw5457-e87493', '2026-07-26 07:10:13.519374+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: parties; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."parties" ("id", "party_type", "full_name", "mobile", "alternate_mobile", "email", "address", "city", "state", "postal_code", "identity_type", "identity_number_masked", "consent", "notes", "created_at", "party_subtype", "user_id", "deleted_at", "org_id") VALUES
	('f991016e-48b8-4063-89f4-e9d263611840', 'seller', 'Jana fi', '00000', NULL, NULL, NULL, 'Fff', NULL, NULL, 'Aadhaar', NULL, true, NULL, '2026-07-30 14:17:32.996354+00', 'bank_auction', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('e311dd66-275e-4b9a-868d-c9ad63aa61dd', 'seller', 'Kotak Mahindra Private Ltd', '9999999999', NULL, NULL, NULL, NULL, 'Tamil Nadu', NULL, 'Aadhaar', NULL, true, 'Point of contact: Venkatachalam V', '2026-07-25 05:58:46.967573+00', 'bank_auction', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('cd688b42-6a1d-42f5-a3d9-d07bcfa8dea0', 'seller', 'indusind', '00000', '000000', NULL, 'maduraai', NULL, 'Tamil Nadu', NULL, 'Aadhaar', NULL, true, NULL, '2026-07-26 04:12:48.633073+00', 'bank_auction', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('2b71252b-8d80-4b4d-84fe-8376bc404ac8', 'seller', 'TATA', '0000', NULL, NULL, NULL, 'MADURAI', NULL, NULL, 'Aadhaar', '00000', true, NULL, '2026-07-26 07:10:06.045567+00', 'bank_auction', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('c4a21c6b-9e44-4e24-93f5-e412500ab357', 'seller', 'MUTHOOT MONEY', '0000', NULL, NULL, NULL, 'NELLAI', NULL, NULL, 'Aadhaar', NULL, true, NULL, '2026-07-26 07:25:06.948915+00', 'bank_auction', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('7c491bb2-3eaa-4052-b009-c7be2592ea65', 'seller', 'HDB BANK', '0000', NULL, NULL, NULL, 'KUMBAKONAM', NULL, NULL, 'Aadhaar', NULL, true, NULL, '2026-07-26 07:35:44.102951+00', 'bank_auction', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: enquiries; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."expenses" ("id", "vehicle_id", "category", "amount", "expense_date", "paid_by_partner_id", "vendor", "bill_available", "bill_url", "description", "approval_status", "approved_by", "approved_at", "notes", "created_at", "user_id", "bill_urls", "deleted_at", "org_id") VALUES
	('54503f67-70aa-4c44-abce-dc1b1981cf04', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Spare parts', 4315.00, '2026-07-27 17:57:43.621317+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/391cd590-514f-40c2-a904-fa2a87e66376/1785460993431-zoa6ip.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-27 17:57:43.011+00', NULL, '2026-07-27 17:57:43.621317+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/391cd590-514f-40c2-a904-fa2a87e66376/1785460993431-zoa6ip.jpg,bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/391cd590-514f-40c2-a904-fa2a87e66376/1785460994815-jd66ze.jpg,bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/391cd590-514f-40c2-a904-fa2a87e66376/1785460996180-b7ssdq.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('5efa84be-b53f-4521-b540-72139f244ba2', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Fuel', 500.00, '2026-07-27 17:54:03.874208+00', NULL, NULL, false, NULL, NULL, 'Approved', 'salam@gmail.com', '2026-07-27 17:54:02.87+00', NULL, '2026-07-27 17:54:03.874208+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', '2026-07-27 17:56:03.74+00', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('0bcc5c85-750a-4a82-89f3-525c65822939', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Mechanic labour', 200.00, '2026-07-27 18:01:42.080824+00', NULL, NULL, false, NULL, NULL, 'Approved', 'salam@gmail.com', '2026-07-27 18:01:41.578+00', NULL, '2026-07-27 18:01:42.080824+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('07ebe819-ffda-45aa-b5a1-604383e41657', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Fuel', 200.00, '2026-07-27 19:25:46.744163+00', NULL, NULL, false, NULL, NULL, 'Approved', 'salam@gmail.com', '2026-07-27 19:25:10.803+00', NULL, '2026-07-27 19:25:46.744163+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('f369a57b-8329-4593-9163-649cae9e9061', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Document transfer', 125.00, '2026-07-27 19:26:00.952555+00', NULL, NULL, false, NULL, NULL, 'Approved', 'salam@gmail.com', '2026-07-27 19:25:25.091+00', NULL, '2026-07-27 19:26:00.952555+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('48c82698-197b-40e4-85ef-a9ff755e81da', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Yard rent', 100.00, '2026-07-27 19:26:14.755674+00', NULL, NULL, false, NULL, NULL, 'Approved', 'salam@gmail.com', '2026-07-27 19:25:39.051+00', NULL, '2026-07-27 19:26:14.755674+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('5e4d8fa1-fe67-44e1-b116-d0b723814f56', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Spare parts', 100.00, '2026-07-27 19:28:53.838887+00', NULL, NULL, false, NULL, NULL, 'Approved', 'salam@gmail.com', '2026-07-27 19:28:18.065+00', NULL, '2026-07-27 19:28:53.838887+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('d04cf9d4-8ff8-45c4-ac02-38b2cfc06b34', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'Yard rent', 2768.00, '2026-07-30 14:21:56.625435+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/a6a2f6b0-4684-4356-9c7b-5a8e1ef7dd0f/1785423574199-m0l03q.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-30 14:21:56.27+00', NULL, '2026-07-30 14:21:56.625435+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/a6a2f6b0-4684-4356-9c7b-5a8e1ef7dd0f/1785423574199-m0l03q.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('9b9bbd40-37bf-4dec-b547-f8532241c049', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'Transportation', 1410.00, '2026-07-30 14:21:37.450719+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/aa4e2423-112b-4ff6-b872-d1f2a7891c0b/1785423592410-ks3d3b.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-30 14:21:37.08+00', NULL, '2026-07-30 14:21:37.450719+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/aa4e2423-112b-4ff6-b872-d1f2a7891c0b/1785423592410-ks3d3b.jpg,bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/aa4e2423-112b-4ff6-b872-d1f2a7891c0b/1785423593213-y63x6a.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('b4e9142c-88af-4d37-8627-07eaeec0f1cf', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'Transportation', 800.00, '2026-07-30 14:21:26.733319+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/4294e955-f180-488a-bc97-5f5a626ea793/1785423821093-aw3lfg.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-30 14:21:26.362+00', NULL, '2026-07-30 14:21:26.733319+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/4294e955-f180-488a-bc97-5f5a626ea793/1785423821093-aw3lfg.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('f27ca153-a0e4-4f68-847a-ac4cb1cc8c5e', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'Transportation', 2000.00, '2026-07-30 14:21:09.502892+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/27994278-c4e1-47b3-9689-4cc4f6e6c957/1785423836425-f4zmnm.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-30 14:21:08.972+00', NULL, '2026-07-30 14:21:09.502892+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/27994278-c4e1-47b3-9689-4cc4f6e6c957/1785423836425-f4zmnm.jpg,bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/27994278-c4e1-47b3-9689-4cc4f6e6c957/1785423836963-by7ywy.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('c67346f0-da40-463c-85f9-b3c551ea126d', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Document transfer', 4000.00, '2026-07-27 17:58:20.035151+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/623dd8d0-bd9e-4083-9d85-d602dcffddd9/1785460806910-ea168h.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-27 17:58:19.474+00', NULL, '2026-07-27 17:58:20.035151+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/623dd8d0-bd9e-4083-9d85-d602dcffddd9/1785460806910-ea168h.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('c8b3dfd7-00b2-4ee5-a052-6eba15a3fdae', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Yard rent', 2083.00, '2026-07-27 17:54:36.325559+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/60ca1a0f-d373-4a86-81d3-8b33d2e034d0/1785461099280-zpd9m3.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-27 17:54:35.534+00', NULL, '2026-07-27 17:54:36.325559+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/60ca1a0f-d373-4a86-81d3-8b33d2e034d0/1785461099280-zpd9m3.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('5004199c-ef69-4488-94e8-1b841efc92fd', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Fuel', 200.00, '2026-07-27 17:55:13.231676+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/41c69fbf-fe58-4bb2-a7a7-fa9794056531/1785461159943-y3fxmh.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-27 17:55:12.618+00', NULL, '2026-07-27 17:55:13.231676+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/41c69fbf-fe58-4bb2-a7a7-fa9794056531/1785461159943-y3fxmh.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('e26e610e-1abf-492f-af8f-bea53b9b28a9', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Other', 200.00, '2026-07-27 19:26:48.325409+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5/6aa74626-35a5-4ecc-8067-695924e667e5/1785461506112-948spm.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-27 19:26:12.255+00', NULL, '2026-07-27 19:26:48.325409+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5/6aa74626-35a5-4ecc-8067-695924e667e5/1785461506112-948spm.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('a5420e93-4993-4b23-ba97-8a5a6610908e', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Transportation', 500.00, '2026-07-27 17:56:30.242263+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/0243ded5-276a-491d-a271-a7b39a392540/1785461190658-qhafy1.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-27 17:56:29.771+00', NULL, '2026-07-27 17:56:30.242263+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/0243ded5-276a-491d-a271-a7b39a392540/1785461190658-qhafy1.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('e16e4e20-6fb1-4610-8f31-a3e7b4e99dac', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Document transfer', 5100.00, '2026-07-26 11:15:13.092435+00', NULL, NULL, false, NULL, NULL, 'Approved', 'salam@gmail.com', '2026-07-26 11:15:13.279+00', NULL, '2026-07-26 11:15:13.092435+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('4c633e91-6fdb-40ed-bc17-60740dc0e800', '120a14f0-2e31-4822-935c-443cd5179770', 'Document transfer', 3000.00, '2026-07-26 11:16:35.444833+00', NULL, NULL, false, NULL, NULL, 'Approved', 'salam@gmail.com', '2026-07-26 11:16:35.634+00', NULL, '2026-07-26 11:16:35.444833+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('5a526766-423e-4e59-a26e-6126e4a377da', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Yard rent', 1025.00, '2026-07-26 11:33:22.181708+00', NULL, NULL, false, NULL, NULL, 'Approved', 'salam@gmail.com', '2026-07-26 11:33:22.215+00', NULL, '2026-07-26 11:33:22.181708+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('8376b858-6bf6-48a5-abb0-9d96be967591', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'Transportation', 400.00, '2026-07-27 17:59:29.246796+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/8aadc065-68bd-4ee1-abf4-cb6d76765f28/1785461286504-4sxrx1.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-27 17:59:28.654+00', NULL, '2026-07-27 17:59:29.246796+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/8aadc065-68bd-4ee1-abf4-cb6d76765f28/1785461286504-4sxrx1.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('38f07166-1961-4aeb-845f-b2be74c141a0', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Spare parts', 939.00, '2026-07-27 18:01:27.604951+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5/718eeb1d-f198-4127-b750-2cfe9d28e22d/1785461529861-kx9hsf.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-27 18:01:27.05+00', NULL, '2026-07-27 18:01:27.604951+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5/718eeb1d-f198-4127-b750-2cfe9d28e22d/1785461529861-kx9hsf.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('4235e4a5-af93-4ac3-b3c8-62792cea420d', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'Transportation', 1000.00, '2026-07-27 18:58:27.043544+00', NULL, NULL, true, 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5/77ccde7a-d656-4302-91df-0c86cfd30fa9/1785461576806-fwoilt.jpg', NULL, 'Approved', 'salam@gmail.com', '2026-07-27 18:58:26.229+00', NULL, '2026-07-27 18:58:27.043544+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5/77ccde7a-d656-4302-91df-0c86cfd30fa9/1785461576806-fwoilt.jpg}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: inspections; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inspections" ("id", "vehicle_id", "inspection_type", "inspection_date", "inspector_name", "overall_manual_score", "accident_status", "accident_evidence", "summary", "status", "created_at", "mechanic_party_id", "user_id", "org_id") VALUES
	('c1a5bee8-3bcc-4b97-be63-97b6c8573a4d', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'Visual only', '2026-07-26 05:20:22.242589+00', NULL, NULL, 'No known accident', NULL, NULL, 'completed', '2026-07-26 05:20:22.242589+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('14e43f53-7475-4160-813b-83431912d873', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Visual only', '2026-07-26 17:16:30.106476+00', NULL, NULL, 'No known accident', NULL, NULL, 'completed', '2026-07-26 17:16:30.106476+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: inspection_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inspection_items" ("id", "inspection_id", "category", "score", "condition_level", "observation", "recommended_action", "estimated_cost", "urgency", "weight", "user_id", "org_id") VALUES
	('a6037876-2415-4274-968d-cf4d17773c82', 'c1a5bee8-3bcc-4b97-be63-97b6c8573a4d', 'Brakes', 90, 'Good', NULL, NULL, 0.00, 'Low', 10.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('6b104ff0-db06-4584-8163-a706174abc2c', 'c1a5bee8-3bcc-4b97-be63-97b6c8573a4d', 'Tyres', 90, 'Good', NULL, NULL, 0.00, 'Low', 8.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('2e1e3311-e222-4d39-819e-852d1ca06ad4', 'c1a5bee8-3bcc-4b97-be63-97b6c8573a4d', 'Suspension', 90, 'Good', NULL, NULL, 0.00, 'Low', 8.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('5603be01-4e37-40db-9fa2-94a6a359b1f4', 'c1a5bee8-3bcc-4b97-be63-97b6c8573a4d', 'Frame and chassis', 90, 'Good', NULL, NULL, 0.00, 'Low', 15.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('bcdfdfe2-4835-4335-9409-36ad3d6d74cf', 'c1a5bee8-3bcc-4b97-be63-97b6c8573a4d', 'Transmission and clutch', 90, 'Good', NULL, NULL, 0.00, 'Low', 10.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('9405caf7-bb7d-4db4-b55f-49996ebd4a34', 'c1a5bee8-3bcc-4b97-be63-97b6c8573a4d', 'Engine', 90, 'Good', NULL, NULL, 0.00, 'Low', 25.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('5d344dee-c984-4b9a-9676-520226c37fe1', '14e43f53-7475-4160-813b-83431912d873', 'Engine', NULL, 'Not inspected', NULL, NULL, 0.00, 'Low', 25.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('6f88cf60-a78b-47d1-ad8d-2fc0c1f097c7', '14e43f53-7475-4160-813b-83431912d873', 'Brakes', NULL, 'Not inspected', NULL, NULL, 0.00, 'Low', 10.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('0c4991dd-ffa0-49c5-883d-117025ad408a', '14e43f53-7475-4160-813b-83431912d873', 'Tyres', NULL, 'Not inspected', NULL, NULL, 0.00, 'Low', 8.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('47e64c3d-3eb6-4923-86d3-da45a1e09a27', '14e43f53-7475-4160-813b-83431912d873', 'Suspension', NULL, 'Not inspected', NULL, NULL, 0.00, 'Low', 8.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('d833c734-11ae-42db-b212-371fa9189989', '14e43f53-7475-4160-813b-83431912d873', 'Frame and chassis', NULL, 'Not inspected', NULL, NULL, 0.00, 'Low', 15.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('072dce32-1277-498a-8896-8a784627d329', '14e43f53-7475-4160-813b-83431912d873', 'Transmission and clutch', NULL, 'Not inspected', NULL, NULL, 0.00, 'Low', 10.00, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: investments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."investments" ("id", "partner_id", "vehicle_id", "amount", "investment_date", "purpose", "payment_method", "reference", "status", "notes", "created_at", "user_id", "proof_url", "proof_urls", "org_id") VALUES
	('93520d64-3009-4668-97bc-c31730cbe23b', 'd2a86c7e-78d8-4a94-96ce-0cf2114ddf37', NULL, 41000.00, '2026-07-22 00:00:00+00', 'Capital contribution', 'Bank transfer', 'ICICI-620315214945', 'Received', NULL, '2026-07-25 05:10:46.050832+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956238909-0k3xxr.jpeg', '{investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956238909-0k3xxr.jpeg}', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('66d27986-129b-4d21-a878-0f3ffbccf9d4', 'd2a86c7e-78d8-4a94-96ce-0cf2114ddf37', NULL, 25000.00, '2026-07-23 00:00:00+00', 'Capital contribution', 'Bank transfer', 'IOB-2026072330673431', 'Received', NULL, '2026-07-25 05:12:33.42848+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956330232-4f0psq.jpeg', '{investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956330232-4f0psq.jpeg}', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('6f206788-b09c-443d-a135-4dea240a1b51', 'd2a86c7e-78d8-4a94-96ce-0cf2114ddf37', NULL, 24000.00, '2026-07-23 00:00:00+00', 'Capital contribution', 'Bank transfer', 'IOB', 'Received', NULL, '2026-07-25 05:13:52.038164+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956407748-eyd436.jpeg', '{investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956407748-eyd436.jpeg}', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('8a2d9ea7-f206-440a-8e66-376421e97306', 'd2a86c7e-78d8-4a94-96ce-0cf2114ddf37', NULL, 23000.00, '2026-07-25 00:00:00+00', 'Capital contribution', 'Bank transfer', 'IOB', 'Received', NULL, '2026-07-25 05:14:28.806666+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956462677-5uemmo.jpeg', '{investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956462677-5uemmo.jpeg}', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('27964b81-f58f-45d8-b088-db92eee3a9c7', 'd2a86c7e-78d8-4a94-96ce-0cf2114ddf37', NULL, 7925.00, '2026-07-25 00:00:00+00', 'Capital contribution', 'Bank transfer', 'iob', 'Received', NULL, '2026-07-25 05:14:50.738685+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956489082-fbpoeb.jpeg', '{investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956489082-fbpoeb.jpeg}', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('f8040564-402c-4674-b25c-30f32ae71033', 'd2a86c7e-78d8-4a94-96ce-0cf2114ddf37', NULL, 900.00, '2026-07-24 00:00:00+00', 'Capital contribution', 'Bank transfer', 'iob-2026072430744792', 'Received', NULL, '2026-07-25 05:19:28.368686+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956763528-jjxvjn.jpeg', '{investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956763528-jjxvjn.jpeg}', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('4c32ec4d-c7e1-4908-ae50-e0b743008d44', 'd2a86c7e-78d8-4a94-96ce-0cf2114ddf37', NULL, 226000.00, '2026-07-25 00:00:00+00', 'Capital contribution', 'Bank transfer', 'IOB2026072430746397', 'Received', 'Ji asslamu alaikkum 
Reg     amount 
7605   51000
5457   44200
6790   36000
7842    23000
9329    41600
2538    21000
5216     46000
7936   45800
0277   34125
         ...................
             342725   
             120925
.......................,.
Tot      221800
Rc       5100   (0277)
       .............,
            226900', '2026-07-25 05:21:30.233041+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956812532-aq5ube.jpeg', '{investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956812532-aq5ube.jpeg}', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('c82636b2-e09b-4ee9-ba58-b47204cd51e5', 'd2a86c7e-78d8-4a94-96ce-0cf2114ddf37', NULL, 70000.00, '2026-07-27 00:00:00+00', 'Capital contribution', 'Bank transfer', '2026072730919831', 'Received', NULL, '2026-07-28 03:04:08.706497+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66/investments/2caf498f-3793-4a18-be39-720023e60698/1785207811335-s9trzt.jpeg', '{bf496ef5-ee27-429d-99d5-770d8b917c66/investments/2caf498f-3793-4a18-be39-720023e60698/1785207811335-s9trzt.jpeg}', 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: mechanic_inspection_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: memberships; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."memberships" ("id", "org_id", "user_id", "role", "status", "display_name", "email", "invited_by", "invited_at", "joined_at", "created_at") VALUES
	('1bc5e7d0-c7f5-470a-888c-b49b8824da9d', 'bf496ef5-ee27-429d-99d5-770d8b917c66', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'owner', 'active', NULL, 'salam@gmail.com', NULL, '2026-07-27 07:27:14.47553+00', '2026-07-27 07:27:14.47553+00', '2026-07-27 07:27:14.47553+00'),
	('804cca5d-35ed-41a0-a6d2-09c81ccd614d', 'bf496ef5-ee27-429d-99d5-770d8b917c66', '97d57315-8348-470f-9e53-c1b20f621268', 'sales_executive', 'invited', 'testexecutive', 'nishajahir22@gmail.com', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-27 07:57:42.620283+00', NULL, '2026-07-27 07:57:42.620283+00');


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profit_distributions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: profit_settlement_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: purchases; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."purchases" ("id", "vehicle_id", "seller_party_id", "purchase_date", "agreed_price", "broker_commission", "other_fee", "payment_status", "handover_location", "odometer_at_purchase", "keys_received", "documents_received", "notes", "created_at", "user_id", "org_id") VALUES
	('dff929cf-dc77-403d-9b8c-1ab32953e4af', 'e215728a-e4b2-4bcc-b8f9-96ebc7f460b1', '2b71252b-8d80-4b4d-84fe-8376bc404ac8', '2026-07-29 06:18:31.148+00', 41000.00, 0.00, 0.00, 'Paid', NULL, NULL, true, false, NULL, '2026-07-29 06:18:31.860989+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('013f048e-d895-4970-a48c-1c5be2725c32', 'f97c7f5a-7970-49f2-92e0-a7bd5376460b', 'f991016e-48b8-4063-89f4-e9d263611840', '2026-07-30 14:19:47.545+00', 26000.00, 0.00, 0.00, 'Paid', NULL, NULL, true, false, NULL, '2026-07-30 14:19:47.942494+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('c29c7de9-7ab1-4065-b8d5-237f517c466d', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'cd688b42-6a1d-42f5-a3d9-d07bcfa8dea0', '2026-07-26 04:15:35.559+00', 51000.00, 0.00, 0.00, 'Paid', NULL, NULL, true, false, NULL, '2026-07-26 04:15:35.828364+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('2697bfae-2193-4815-af8a-3a5aa1aa36f9', 'e874930a-e059-4084-afe2-dba5fce82128', '2b71252b-8d80-4b4d-84fe-8376bc404ac8', '2026-07-26 07:10:13.03+00', 44200.00, 0.00, 0.00, 'Paid', 'MADURAI', NULL, true, false, NULL, '2026-07-26 07:10:13.130722+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('71864997-b1d4-4f1e-ad2c-d311e66736fd', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'c4a21c6b-9e44-4e24-93f5-e412500ab357', '2026-07-26 07:25:16.068+00', 36000.00, 0.00, 0.00, 'Paid', NULL, NULL, true, false, NULL, '2026-07-26 07:25:16.117739+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('bf0f6b47-c483-47f9-8a35-c1afbe4fd577', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'c4a21c6b-9e44-4e24-93f5-e412500ab357', '2026-07-26 07:30:27.424+00', 23000.00, 0.00, 0.00, 'Paid', NULL, NULL, true, false, NULL, '2026-07-26 07:30:27.478677+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('523f6135-d4b4-456b-a1dd-cacde5f9bb58', '120a14f0-2e31-4822-935c-443cd5179770', 'cd688b42-6a1d-42f5-a3d9-d07bcfa8dea0', '2026-07-26 07:32:29.43+00', 21000.00, 0.00, 0.00, 'Paid', NULL, NULL, true, false, NULL, '2026-07-26 07:32:29.477375+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('97fd2bc2-9234-434d-b324-28d786c18b23', '546e52eb-5e44-464f-8de8-ac244fdb2f92', 'cd688b42-6a1d-42f5-a3d9-d07bcfa8dea0', '2026-07-26 07:33:43.297+00', 46000.00, 0.00, 0.00, 'Paid', NULL, NULL, true, false, NULL, '2026-07-26 07:33:43.346218+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('e092b369-585d-406a-b3ed-ea5bfb331a50', '8ae3388d-5818-4367-971a-78298eb10370', '7c491bb2-3eaa-4052-b009-c7be2592ea65', '2026-07-26 07:35:46.901+00', 45800.00, 0.00, 0.00, 'Paid', NULL, NULL, true, false, NULL, '2026-07-26 07:35:46.939701+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('05f40703-1675-43ae-bd63-d428f42fa996', '129c1c35-e0e2-41fa-977f-35161dff381c', 'e311dd66-275e-4b9a-868d-c9ad63aa61dd', '2026-07-26 07:36:45.648+00', 33100.00, 0.00, 0.00, 'Paid', NULL, NULL, true, false, NULL, '2026-07-26 07:36:45.691621+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('a3f28944-2537-495a-a3ec-ff90c7c252fe', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'e311dd66-275e-4b9a-868d-c9ad63aa61dd', '2026-07-26 07:27:30.504+00', 41600.00, 0.00, 0.00, 'Paid', NULL, NULL, true, false, NULL, '2026-07-26 07:27:30.566575+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: purchase_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."purchase_payments" ("id", "purchase_id", "amount", "payment_method", "reference", "paid_at", "notes", "user_id", "proof_urls", "org_id") VALUES
	('7cc766e9-6444-4bbe-bbde-5f76e513dbef', 'dff929cf-dc77-403d-9b8c-1ab32953e4af', 41000.00, 'Cash', NULL, '2026-07-29 06:18:31.686+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('36fcb7dc-3a70-4f50-92f2-b726a252dd34', '013f048e-d895-4970-a48c-1c5be2725c32', 26000.00, 'Cash', NULL, '2026-07-30 14:19:47.764+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('de181180-fd72-4138-ae23-861bf026abf1', 'c29c7de9-7ab1-4065-b8d5-237f517c466d', 51000.00, 'UPI', NULL, '2026-07-26 04:15:35.78+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('2b30167d-5c2f-4e1b-b2d6-d8cb5d35b68f', '2697bfae-2193-4815-af8a-3a5aa1aa36f9', 44200.00, 'UPI', '000', '2026-07-26 07:10:13.235+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('b5c35a51-1da4-4951-8fa3-a10c8121733e', '71864997-b1d4-4f1e-ad2c-d311e66736fd', 36000.00, 'UPI', NULL, '2026-07-26 07:25:16.238+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('51d3d733-d9b9-427f-954c-43553dac5bc8', 'bf0f6b47-c483-47f9-8a35-c1afbe4fd577', 23000.00, 'UPI', NULL, '2026-07-26 07:30:27.601+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('551621b3-8ade-4e21-a2b3-de3995180e94', '523f6135-d4b4-456b-a1dd-cacde5f9bb58', 21000.00, 'UPI', NULL, '2026-07-26 07:32:29.607+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('e23017f8-08b5-4f72-a890-0972f82f3e8f', '97fd2bc2-9234-434d-b324-28d786c18b23', 46000.00, 'UPI', NULL, '2026-07-26 07:33:43.475+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('c7705150-52bb-4cd3-a196-5294cb0d4028', 'e092b369-585d-406a-b3ed-ea5bfb331a50', 45800.00, 'UPI', NULL, '2026-07-26 07:35:47.073+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('5b4f1d19-8f9f-44f0-82db-0aa26ea314a2', '05f40703-1675-43ae-bd63-d428f42fa996', 33100.00, 'UPI', NULL, '2026-07-26 07:36:45.824+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('38221c93-a008-4815-9902-17fdfecff915', 'a3f28944-2537-495a-a3ec-ff90c7c252fe', 41600.00, 'UPI', NULL, '2026-07-26 07:27:30.711+00', NULL, '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: sale_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: stock_number_counters; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."stock_number_counters" ("year", "last_value", "org_id") VALUES
	(2026, 14, 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: vehicle_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vehicle_documents" ("id", "vehicle_id", "document_type", "document_number", "issue_date", "expiry_date", "issuer", "verification_status", "verified_by", "verified_at", "file_url", "version", "notes", "created_at", "user_id", "file_urls", "deleted_at", "org_id") VALUES
	('84badbf4-4c82-48f4-a2db-a11625ecf771', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'RC book', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, NULL, 1, NULL, '2026-07-26 04:27:07.249938+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('8f4d4de4-6f5a-499b-8818-19c309695286', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'Insurance', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, NULL, 1, NULL, '2026-07-26 04:27:07.249938+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('177fc47f-8a9c-46ea-bbec-a55f0f3dbe0e', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'PUC', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, NULL, 1, NULL, '2026-07-26 04:27:07.249938+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('782531d1-ad5e-408d-b0da-a95751f1bc2a', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'Seller identity', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, NULL, 1, NULL, '2026-07-26 04:27:07.249938+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('af76b559-55af-4dc8-8080-770ab4d451a2', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'Sale agreement', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, NULL, 1, NULL, '2026-07-26 04:27:07.249938+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('be632dd3-06c1-475e-bc46-af6e6a1eb23a', '129c1c35-e0e2-41fa-977f-35161dff381c', 'RC book', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, NULL, 1, NULL, '2026-07-27 11:17:54.120926+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('503bae06-c007-4df0-87ca-537b88da105e', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Insurance', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, NULL, 1, NULL, '2026-07-27 11:17:54.120926+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('4df8d323-8097-4217-94c8-d1830faca3fe', '129c1c35-e0e2-41fa-977f-35161dff381c', 'PUC', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, NULL, 1, NULL, '2026-07-27 11:17:54.120926+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('a1265475-e6e5-4fb8-9665-06ff994d376b', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Seller identity', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, NULL, 1, NULL, '2026-07-27 11:17:54.120926+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('203fb637-b159-4403-b511-671b0815605e', '129c1c35-e0e2-41fa-977f-35161dff381c', 'Sale agreement', NULL, NULL, NULL, NULL, 'Not uploaded', NULL, NULL, NULL, 1, NULL, '2026-07-27 11:17:54.120926+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: vehicle_media; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vehicle_media" ("id", "vehicle_id", "media_type", "media_category", "file_url", "thumbnail_url", "uploaded_at", "user_id", "deleted_at", "org_id") VALUES
	('7f5a8505-3969-4dd2-9858-cbce56535ec5', '129c1c35-e0e2-41fa-977f-35161dff381c', 'photo', 'general', 'bf496ef5-ee27-429d-99d5-770d8b917c66/129c1c35-e0e2-41fa-977f-35161dff381c/1785461889681-u6rtlh.jpg', NULL, '2026-07-31 01:38:11.21174+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('1169f3aa-6303-4ec0-99cd-1a8dfb70d738', '8ae3388d-5818-4367-971a-78298eb10370', 'photo', 'general', 'bf496ef5-ee27-429d-99d5-770d8b917c66/8ae3388d-5818-4367-971a-78298eb10370/1785461951706-i88394.jpg', NULL, '2026-07-31 01:39:13.119265+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('1f6cf522-10c5-43a7-bc3f-5e8e42ca9f6e', '546e52eb-5e44-464f-8de8-ac244fdb2f92', 'photo', 'general', 'bf496ef5-ee27-429d-99d5-770d8b917c66/546e52eb-5e44-464f-8de8-ac244fdb2f92/1785461967761-5qyyzj.jpg', NULL, '2026-07-31 01:39:29.295168+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('97cc5948-3966-4f03-861e-e720dd43d8ea', '120a14f0-2e31-4822-935c-443cd5179770', 'photo', 'general', 'bf496ef5-ee27-429d-99d5-770d8b917c66/120a14f0-2e31-4822-935c-443cd5179770/1785461978433-t4qmmz.jpg', NULL, '2026-07-31 01:39:39.6354+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('f93e95ae-f89f-4a40-9147-64a68ce3dabf', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'photo', 'general', 'bf496ef5-ee27-429d-99d5-770d8b917c66/1c27e8bc-339b-417f-b62a-a7719a68e6ed/1785462036189-wri0pa.jpg', NULL, '2026-07-31 01:40:39.276961+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('058b9a7f-9338-47b5-a6cc-9a192e6432f3', 'e874930a-e059-4084-afe2-dba5fce82128', 'photo', 'general', 'bf496ef5-ee27-429d-99d5-770d8b917c66/e874930a-e059-4084-afe2-dba5fce82128/1785462059295-cb2wuw.jpg', NULL, '2026-07-31 01:41:00.847077+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('f906bb35-b02b-4890-ba7d-698d555ddf12', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'photo', 'general', 'bf496ef5-ee27-429d-99d5-770d8b917c66/72a10765-1ab6-4353-bb50-30e22fbf4fa0/1785462076334-edp8p7.jpg', NULL, '2026-07-31 01:41:17.341984+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('cdab8ac7-aace-4e0d-98b3-c4fd31c2f9c7', 'e215728a-e4b2-4bcc-b8f9-96ebc7f460b1', 'photo', 'general', 'bf496ef5-ee27-429d-99d5-770d8b917c66/e215728a-e4b2-4bcc-b8f9-96ebc7f460b1/1785462099866-vp6re8.jpg', NULL, '2026-07-31 01:41:41.195675+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('4b019c5c-61af-4a14-9ec7-14f23d5beae8', 'f97c7f5a-7970-49f2-92e0-a7bd5376460b', 'photo', 'general', 'bf496ef5-ee27-429d-99d5-770d8b917c66/f97c7f5a-7970-49f2-92e0-a7bd5376460b/1785462119137-5yt2ee.jpg', NULL, '2026-07-31 01:42:00.345282+00', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', NULL, 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: vehicle_profit_share_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: vehicle_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vehicle_status_history" ("id", "vehicle_id", "previous_status", "new_status", "changed_at", "reason", "user_id", "org_id") VALUES
	('afec5849-b128-411f-b931-2b630e3d7234', '72a10765-1ab6-4353-bb50-30e22fbf4fa0', 'DRAFT', 'PURCHASED', '2026-07-26 04:15:35.609707+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('7acda073-b333-414f-8c16-828c8a719a00', 'e874930a-e059-4084-afe2-dba5fce82128', 'DRAFT', 'PURCHASED', '2026-07-26 07:10:12.91584+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('667c07d5-f50c-4757-ae57-a337ab52590e', '6c542e70-ab80-474e-bc1d-dffb1c448c76', 'DRAFT', 'PURCHASED', '2026-07-26 07:25:15.950735+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('fc6af8f2-4287-4cce-a186-ec22a4ed7d62', '72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5', 'DRAFT', 'PURCHASED', '2026-07-26 07:27:30.369314+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('c73b5fcc-71a3-458d-9018-a8b2e2e0f759', '1c27e8bc-339b-417f-b62a-a7719a68e6ed', 'DRAFT', 'PURCHASED', '2026-07-26 07:30:27.302934+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('3d33ba61-38e8-4ce9-a0e5-83cf079b4a29', '120a14f0-2e31-4822-935c-443cd5179770', 'DRAFT', 'PURCHASED', '2026-07-26 07:32:29.304129+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('a30f0b4f-84ad-4f88-9594-4f353fc98d87', '546e52eb-5e44-464f-8de8-ac244fdb2f92', 'DRAFT', 'PURCHASED', '2026-07-26 07:33:43.170902+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('ff8fa4af-89e5-4512-ac0b-d72d891f398d', '8ae3388d-5818-4367-971a-78298eb10370', 'DRAFT', 'PURCHASED', '2026-07-26 07:35:46.774885+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('bbb41d30-9845-4f47-bb88-fa50279f4ebd', '129c1c35-e0e2-41fa-977f-35161dff381c', 'DRAFT', 'PURCHASED', '2026-07-26 07:36:45.51925+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('cdc9099c-cb38-4c99-adf9-c775c4f379de', 'e215728a-e4b2-4bcc-b8f9-96ebc7f460b1', 'DRAFT', 'PURCHASED', '2026-07-29 06:18:31.376114+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66'),
	('37498d23-d16d-4442-b983-6b4d8355acf0', 'f97c7f5a-7970-49f2-92e0-a7bd5376460b', 'DRAFT', 'PURCHASED', '2026-07-30 14:19:47.719514+00', 'Vehicle onboarded', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', 'bf496ef5-ee27-429d-99d5-770d8b917c66');


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES
	('vehicle-documents', 'vehicle-documents', NULL, '2026-07-21 13:02:23.547967+00', '2026-07-21 13:02:23.547967+00', false, false, NULL, NULL, NULL, 'STANDARD'),
	('finance-proofs', 'finance-proofs', NULL, '2026-07-24 16:42:11.013316+00', '2026-07-24 16:42:11.013316+00', false, false, NULL, NULL, NULL, 'STANDARD'),
	('vehicle-photos', 'vehicle-photos', NULL, '2026-07-25 17:50:42.944407+00', '2026-07-25 17:50:42.944407+00', false, false, NULL, NULL, NULL, 'STANDARD');


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") VALUES
	('94684f55-7816-4314-9c98-b49cd03e38e9', 'vehicle-documents', '20579f39-34dc-42ee-a8bf-5a01f242cf31/1784640179481-k4kdoa.png', NULL, '2026-07-21 13:22:59.223612+00', '2026-07-21 13:22:59.223612+00', '2026-07-21 13:22:59.223612+00', '{"eTag": "\"927d9f01a51ebdebc38944ba427acaf9\"", "size": 53489, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-07-21T13:23:00.000Z", "contentLength": 53489, "httpStatusCode": 200}', '095322fe-1efa-4067-9123-afe33264182c', NULL, '{}'),
	('d5b2e91a-bbe4-4eff-9c05-8ae1b6d6cfda', 'vehicle-photos', 'bf496ef5-ee27-429d-99d5-770d8b917c66/e215728a-e4b2-4bcc-b8f9-96ebc7f460b1/1785462099866-vp6re8.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:41:40.964848+00', '2026-07-31 01:41:40.964848+00', '2026-07-31 01:41:40.964848+00', '{"eTag": "\"98293b2b43ec511500abdb871343cbc5\"", "size": 280138, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:41:41.000Z", "contentLength": 280138, "httpStatusCode": 200}', '1ba4b1e1-cd94-4fff-a1b4-5da0a10577dd', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('4860a24a-180c-4657-915b-b4d674cd839f', 'vehicle-documents', '20579f39-34dc-42ee-a8bf-5a01f242cf31/1784640210445-dh66sf.png', NULL, '2026-07-21 13:23:30.070017+00', '2026-07-21 13:23:30.070017+00', '2026-07-21 13:23:30.070017+00', '{"eTag": "\"927d9f01a51ebdebc38944ba427acaf9\"", "size": 53489, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-07-21T13:23:31.000Z", "contentLength": 53489, "httpStatusCode": 200}', 'c5f6c55e-978a-4b77-b539-ed4e0c514516', NULL, '{}'),
	('f237881a-ae84-4036-9389-1f05a8f87f32', 'finance-proofs', 'investments/6c546d76-68bc-4765-9023-3c388ede1fce/1784911892945-a8b16h.png', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '2026-07-24 16:51:32.99261+00', '2026-07-24 16:51:32.99261+00', '2026-07-24 16:51:32.99261+00', '{"eTag": "\"25ea409971652cb52ad10df6dd991357\"", "size": 342, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-07-24T16:51:33.000Z", "contentLength": 342, "httpStatusCode": 200}', '0b11e9c7-cff4-4385-80a0-60139a80b9f1', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '{}'),
	('0ba67336-23f3-49f3-bdf2-67ad831868aa', 'vehicle-photos', 'bf496ef5-ee27-429d-99d5-770d8b917c66/f97c7f5a-7970-49f2-92e0-a7bd5376460b/1785462119137-5yt2ee.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:42:00.063336+00', '2026-07-31 01:42:00.063336+00', '2026-07-31 01:42:00.063336+00', '{"eTag": "\"c6a3bca47d68484bae7af72acd4172c9\"", "size": 273587, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:42:01.000Z", "contentLength": 273587, "httpStatusCode": 200}', '1c317823-04f2-409d-9417-cdf6f6a926e1', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('b6f8f30e-974f-4464-b775-46871ff3975a', 'finance-proofs', 'settlements/dad57635-4bd4-46a7-8166-125f13d92ade/1784912028454-zt0bnh.png', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '2026-07-24 16:53:47.308874+00', '2026-07-24 16:53:47.308874+00', '2026-07-24 16:53:47.308874+00', '{"eTag": "\"25ea409971652cb52ad10df6dd991357\"", "size": 342, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-07-24T16:53:48.000Z", "contentLength": 342, "httpStatusCode": 200}', 'b1016b2b-3d3a-435f-9530-4f27650f8678', '100d13b9-906a-43b0-a42c-e77d6417bbf8', '{}'),
	('96370962-b742-403f-960c-96f9580771a9', 'finance-proofs', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956238909-0k3xxr.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 05:10:38.624369+00', '2026-07-25 05:10:38.624369+00', '2026-07-25 05:10:38.624369+00', '{"eTag": "\"eca991e4581c4068fd5273175cad36f4\"", "size": 101681, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T05:10:39.000Z", "contentLength": 101681, "httpStatusCode": 200}', 'e9e66ce7-b4f5-4d7f-b60b-bab0dd6cc3ea', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('8f7db404-11d5-4682-95d4-a7e6143ce661', 'finance-proofs', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956330232-4f0psq.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 05:12:09.602932+00', '2026-07-25 05:12:09.602932+00', '2026-07-25 05:12:09.602932+00', '{"eTag": "\"9d25fefd10550e0d7c5e9cd61551f4af\"", "size": 184185, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T05:12:10.000Z", "contentLength": 184185, "httpStatusCode": 200}', 'dac7d357-b26b-407e-8c6d-ebba330214cb', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('5a382e55-fc98-4c8f-9d70-63e16e60cd12', 'finance-proofs', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956407748-eyd436.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 05:13:27.062104+00', '2026-07-25 05:13:27.062104+00', '2026-07-25 05:13:27.062104+00', '{"eTag": "\"b56144aec056c68f9ecbe8abd7579329\"", "size": 178920, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T05:13:28.000Z", "contentLength": 178920, "httpStatusCode": 200}', '33b1b1f8-a044-4b53-af76-5286f65a9c35', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('3c3fa8bc-5368-4320-8d2b-1a069b2b65cb', 'finance-proofs', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956462677-5uemmo.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 05:14:22.306225+00', '2026-07-25 05:14:22.306225+00', '2026-07-25 05:14:22.306225+00', '{"eTag": "\"5ba71793a0a12b29e962416dd6fd99bc\"", "size": 160179, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T05:14:23.000Z", "contentLength": 160179, "httpStatusCode": 200}', '413dd557-6972-4478-a2ef-b20b8e3e2364', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('b76f7c83-4394-41f4-b106-fac47cc5e715', 'finance-proofs', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956489082-fbpoeb.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 05:14:48.278639+00', '2026-07-25 05:14:48.278639+00', '2026-07-25 05:14:48.278639+00', '{"eTag": "\"31400571b9dfaa517398b659057bb3ce\"", "size": 168878, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T05:14:49.000Z", "contentLength": 168878, "httpStatusCode": 200}', 'ad451c8e-7b85-4857-8b2e-f7c755007bee', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('22c9cdd7-d0b2-4440-9363-f001a13438f1', 'finance-proofs', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956763528-jjxvjn.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 05:19:22.90775+00', '2026-07-25 05:19:22.90775+00', '2026-07-25 05:19:22.90775+00', '{"eTag": "\"77deecfdaf660dd735601633cec7444e\"", "size": 208413, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T05:19:23.000Z", "contentLength": 208413, "httpStatusCode": 200}', '6c2db88b-4241-4195-8e6a-3cbe56c1ae55', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('4f0f46f3-88df-4961-b5b6-fb9e60d222ef', 'finance-proofs', 'investments/d2a86c7e-78d8-4a94-96ce-0cf2114ddf37/1784956812532-aq5ube.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 05:20:11.956517+00', '2026-07-25 05:20:11.956517+00', '2026-07-25 05:20:11.956517+00', '{"eTag": "\"2150b648da7af9eea194e4b63ff8d4e6\"", "size": 246893, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T05:20:12.000Z", "contentLength": 246893, "httpStatusCode": 200}', '2342c034-5a3a-404f-8722-5c90c23d7805', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('1e4cddd2-cc5c-4568-8da4-b338ad086fa0', 'finance-proofs', 'expenses/2d7941b2-65dc-4e98-87b4-aa69a576d0d1/d6fd4527-b04f-4a37-bcdd-b62f1ca6a4c1/1784981625400-9zgb9w.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 12:13:44.473399+00', '2026-07-25 12:13:44.473399+00', '2026-07-25 12:13:44.473399+00', '{"eTag": "\"2150b648da7af9eea194e4b63ff8d4e6\"", "size": 246893, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T12:13:45.000Z", "contentLength": 246893, "httpStatusCode": 200}', '4f72bf15-9c9d-4ff0-a401-cc43ef1d9732', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('0638db47-9540-4d09-8356-3ccd46a476a6', 'finance-proofs', 'expenses/2d7941b2-65dc-4e98-87b4-aa69a576d0d1/d6fd4527-b04f-4a37-bcdd-b62f1ca6a4c1/1784981628321-wtz427.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 12:13:47.543287+00', '2026-07-25 12:13:47.543287+00', '2026-07-25 12:13:47.543287+00', '{"eTag": "\"77deecfdaf660dd735601633cec7444e\"", "size": 208413, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T12:13:48.000Z", "contentLength": 208413, "httpStatusCode": 200}', '563b1b00-355e-4dc0-9f20-21e0f8de9b9b', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('3e6c5be7-2308-4ed8-8643-4884d48e286c', 'finance-proofs', 'purchase-payments/adbe6b0f-2cdd-4913-a3c1-f10ce5eb7fac/1784981665995-x3lu56.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 12:14:25.093079+00', '2026-07-25 12:14:25.093079+00', '2026-07-25 12:14:25.093079+00', '{"eTag": "\"2150b648da7af9eea194e4b63ff8d4e6\"", "size": 246893, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T12:14:26.000Z", "contentLength": 246893, "httpStatusCode": 200}', 'c0474a32-cdb9-4749-9c05-a59c4107fc9b', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('c53a9f53-ad16-4ae4-910e-0a74344a653a', 'finance-proofs', 'purchase-payments/adbe6b0f-2cdd-4913-a3c1-f10ce5eb7fac/1784981672183-o8nrfp.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 12:14:31.16253+00', '2026-07-25 12:14:31.16253+00', '2026-07-25 12:14:31.16253+00', '{"eTag": "\"eca991e4581c4068fd5273175cad36f4\"", "size": 101681, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T12:14:32.000Z", "contentLength": 101681, "httpStatusCode": 200}', 'f57412cb-824b-4d13-9c12-3213fc394a01', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('b4852cc2-c089-4b57-88db-72757551575a', 'finance-proofs', 'purchase-payments/adbe6b0f-2cdd-4913-a3c1-f10ce5eb7fac/1784981672599-g6o35b.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 12:14:31.826713+00', '2026-07-25 12:14:31.826713+00', '2026-07-25 12:14:31.826713+00', '{"eTag": "\"2150b648da7af9eea194e4b63ff8d4e6\"", "size": 246893, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T12:14:32.000Z", "contentLength": 246893, "httpStatusCode": 200}', 'e027b55e-5c2f-43ab-860b-0ddaf95a475f', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('2aecb17c-858f-46ca-8285-d89b5ff91fdd', 'finance-proofs', 'purchase-payments/adbe6b0f-2cdd-4913-a3c1-f10ce5eb7fac/1784981673282-zpuuf7.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 12:14:32.345798+00', '2026-07-25 12:14:32.345798+00', '2026-07-25 12:14:32.345798+00', '{"eTag": "\"77deecfdaf660dd735601633cec7444e\"", "size": 208413, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T12:14:33.000Z", "contentLength": 208413, "httpStatusCode": 200}', '363906ca-a258-4777-9d8e-4d1a83d77e0e', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('8965b560-c179-413f-ab35-175e7fd1f423', 'vehicle-documents', '2d7941b2-65dc-4e98-87b4-aa69a576d0d1/c1ce6601-ad3e-4be8-8d84-a0d3339d02ab/1784981816093-5238vc.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 12:16:55.097203+00', '2026-07-25 12:16:55.097203+00', '2026-07-25 12:16:55.097203+00', '{"eTag": "\"5d1632a49d97c1276e955f63acb808db\"", "size": 103688, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T12:16:56.000Z", "contentLength": 103688, "httpStatusCode": 200}', 'c6b9be25-c99b-4c1e-9016-eb30fb02c50e', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('d9a8a6c4-bba0-4f03-9ff8-b820a7d56f48', 'vehicle-documents', '2d7941b2-65dc-4e98-87b4-aa69a576d0d1/c1ce6601-ad3e-4be8-8d84-a0d3339d02ab/1784981816532-z222tn.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 12:16:55.701375+00', '2026-07-25 12:16:55.701375+00', '2026-07-25 12:16:55.701375+00', '{"eTag": "\"999da153c2fa6f3ae36ac2650f48904e\"", "size": 108897, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T12:16:56.000Z", "contentLength": 108897, "httpStatusCode": 200}', '64f28ec7-6fa1-499f-9238-6c2285ab45b6', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('6d53d388-d54e-4cef-bcf0-b1044796d97a', 'vehicle-documents', '2d7941b2-65dc-4e98-87b4-aa69a576d0d1/3216be6f-3c94-406f-b6fe-73841fdb1886/1784981851045-d3px2b.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 12:17:30.379052+00', '2026-07-25 12:17:30.379052+00', '2026-07-25 12:17:30.379052+00', '{"eTag": "\"5d1632a49d97c1276e955f63acb808db\"", "size": 103688, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T12:17:31.000Z", "contentLength": 103688, "httpStatusCode": 200}', 'defbb334-70f2-4c1f-9422-35af04b6a62c', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('28fa1b97-2843-4e84-9408-6f243d6c708b', 'vehicle-documents', '2d7941b2-65dc-4e98-87b4-aa69a576d0d1/3216be6f-3c94-406f-b6fe-73841fdb1886/1784981851836-gyolv1.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-25 12:17:30.831215+00', '2026-07-25 12:17:30.831215+00', '2026-07-25 12:17:30.831215+00', '{"eTag": "\"999da153c2fa6f3ae36ac2650f48904e\"", "size": 108897, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-25T12:17:31.000Z", "contentLength": 108897, "httpStatusCode": 200}', '353b58e2-cf07-4c97-875c-c3018990d5c1', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('04101db2-4441-46cc-9429-5e3e1e5af844', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/investments/2caf498f-3793-4a18-be39-720023e60698/1785207811335-s9trzt.jpeg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-28 03:03:30.076232+00', '2026-07-28 03:03:30.076232+00', '2026-07-28 03:03:30.076232+00', '{"eTag": "\"534973daae78131f5f10afc1872c3c7e\"", "size": 164312, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-28T03:03:31.000Z", "contentLength": 164312, "httpStatusCode": 200}', 'baacb5b6-2def-421f-ac57-a08e97a34f6c', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('ca671b1e-e5c3-4bc3-a4af-e03a23d3fa15', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/ad818b0b-e6db-4e89-aeee-b59c6bd8331e/1785423387621-yuk64g.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-30 14:56:28.694395+00', '2026-07-30 14:56:28.694395+00', '2026-07-30 14:56:28.694395+00', '{"eTag": "\"db2c40415e4a5ab0cf1b64ea5f4803d5\"", "size": 92626, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-30T14:56:29.000Z", "contentLength": 92626, "httpStatusCode": 200}', '2b72fe50-33ad-499c-83f2-8bb726438acf', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('703fe6fa-e698-4c3a-b3de-0eb6363edbbe', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/a6a2f6b0-4684-4356-9c7b-5a8e1ef7dd0f/1785423574199-m0l03q.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-30 14:59:35.274029+00', '2026-07-30 14:59:35.274029+00', '2026-07-30 14:59:35.274029+00', '{"eTag": "\"371f70dc016500860d889b39233129a6\"", "size": 209839, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-30T14:59:36.000Z", "contentLength": 209839, "httpStatusCode": 200}', '0ff1f7e4-69a5-4d66-8737-0b3530b634eb', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('a62e0c1c-1c08-446b-ac70-51f1932c1d63', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/aa4e2423-112b-4ff6-b872-d1f2a7891c0b/1785423592410-ks3d3b.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-30 14:59:53.318633+00', '2026-07-30 14:59:53.318633+00', '2026-07-30 14:59:53.318633+00', '{"eTag": "\"760ea71d4a383aeb0c6632ab3287105d\"", "size": 155925, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-30T14:59:54.000Z", "contentLength": 155925, "httpStatusCode": 200}', 'a021d106-5f59-48be-918b-a02e93e88c1f', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('9c1165e0-d841-4a94-b22e-547bedebf399', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/aa4e2423-112b-4ff6-b872-d1f2a7891c0b/1785423593213-y63x6a.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-30 14:59:54.02644+00', '2026-07-30 14:59:54.02644+00', '2026-07-30 14:59:54.02644+00', '{"eTag": "\"62d7b629e1d6ea6d0475006a0125d18f\"", "size": 148198, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-30T14:59:54.000Z", "contentLength": 148198, "httpStatusCode": 200}', '3e051508-7808-43c9-a7c3-584b882ea291', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('1e3dd05e-13c7-4183-99fb-6f7574f82f69', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/4294e955-f180-488a-bc97-5f5a626ea793/1785423821093-aw3lfg.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-30 15:03:41.936717+00', '2026-07-30 15:03:41.936717+00', '2026-07-30 15:03:41.936717+00', '{"eTag": "\"fb9e87359600a6004406b84fe79c056e\"", "size": 149826, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-30T15:03:42.000Z", "contentLength": 149826, "httpStatusCode": 200}', 'c77b2eaf-4d58-48bd-9cd7-ab596f5aa0c2', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('1305b330-e548-43e7-8bd6-def86a813cb6', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/27994278-c4e1-47b3-9689-4cc4f6e6c957/1785423836425-f4zmnm.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-30 15:03:57.126568+00', '2026-07-30 15:03:57.126568+00', '2026-07-30 15:03:57.126568+00', '{"eTag": "\"760ea71d4a383aeb0c6632ab3287105d\"", "size": 155925, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-30T15:03:58.000Z", "contentLength": 155925, "httpStatusCode": 200}', 'b3dd3575-b19b-4c55-9173-5912d0d06c75', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('f5e1d225-32a8-437b-be5a-f408d80dba5d', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/6c542e70-ab80-474e-bc1d-dffb1c448c76/27994278-c4e1-47b3-9689-4cc4f6e6c957/1785423836963-by7ywy.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-30 15:03:57.96987+00', '2026-07-30 15:03:57.96987+00', '2026-07-30 15:03:57.96987+00', '{"eTag": "\"62d7b629e1d6ea6d0475006a0125d18f\"", "size": 148198, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-30T15:03:58.000Z", "contentLength": 148198, "httpStatusCode": 200}', '0e66e289-a66e-4682-aec2-8778ed100483', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('93b13057-779b-41c4-8808-fbd0ddff349b', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/623dd8d0-bd9e-4083-9d85-d602dcffddd9/1785460806910-ea168h.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:20:08.145467+00', '2026-07-31 01:20:08.145467+00', '2026-07-31 01:20:08.145467+00', '{"eTag": "\"cf039cc741b6a93f23f241f3a6b117c4\"", "size": 182935, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:20:08.000Z", "contentLength": 182935, "httpStatusCode": 200}', 'd972154d-2f43-4a5e-ac71-f826f5a28cc4', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('fcf172a5-2bab-4ec6-ad1a-2073b8283966', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/391cd590-514f-40c2-a904-fa2a87e66376/1785460993431-zoa6ip.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:23:14.851458+00', '2026-07-31 01:23:14.851458+00', '2026-07-31 01:23:14.851458+00', '{"eTag": "\"21f48aaab9b9e5c0ed472a00483f6afe\"", "size": 968766, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:23:15.000Z", "contentLength": 968766, "httpStatusCode": 200}', '76733989-6546-43fb-b1ba-a04785b49336', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('38005064-db80-483a-b2ea-7f008503af43', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/391cd590-514f-40c2-a904-fa2a87e66376/1785460994815-jd66ze.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:23:16.305265+00', '2026-07-31 01:23:16.305265+00', '2026-07-31 01:23:16.305265+00', '{"eTag": "\"9343259f5c44d9f886726e5889f0837b\"", "size": 1159370, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:23:17.000Z", "contentLength": 1159370, "httpStatusCode": 200}', 'e89aef04-e035-469d-af11-eaa330e45882', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('90f786f9-572c-4a3a-a0c2-428f841fe324', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/391cd590-514f-40c2-a904-fa2a87e66376/1785460996180-b7ssdq.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:23:17.180216+00', '2026-07-31 01:23:17.180216+00', '2026-07-31 01:23:17.180216+00', '{"eTag": "\"f397f3deb94a9a73f810dbc16fee5c77\"", "size": 1353246, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:23:18.000Z", "contentLength": 1353246, "httpStatusCode": 200}', '0e7c4d1d-8cef-4e4b-91da-d5c330e5a02d', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('973c7718-78d7-418f-968c-b51a1833658f', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/60ca1a0f-d373-4a86-81d3-8b33d2e034d0/1785461099280-zpd9m3.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:25:01.55721+00', '2026-07-31 01:25:01.55721+00', '2026-07-31 01:25:01.55721+00', '{"eTag": "\"9234b305fbf0887fe5c401b3842a5e0d\"", "size": 3022401, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:25:02.000Z", "contentLength": 3022401, "httpStatusCode": 200}', 'd817826c-93a9-42b2-8cbf-646167af01f1', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('43565f6c-d643-4d05-b9b6-3f9dd287c61f', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/41c69fbf-fe58-4bb2-a7a7-fa9794056531/1785461159943-y3fxmh.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:26:00.947178+00', '2026-07-31 01:26:00.947178+00', '2026-07-31 01:26:00.947178+00', '{"eTag": "\"2ebd8ca48bc8842239167042aa7536cb\"", "size": 165959, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:26:01.000Z", "contentLength": 165959, "httpStatusCode": 200}', '998579eb-ab09-4d33-942c-250d438ab592', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('279ec514-c301-44ce-9d3e-96c526ee3647', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/5e08072e-7430-4fd3-8536-64352df12e2e/1785461177601-rjbk1k.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:26:18.554852+00', '2026-07-31 01:26:18.554852+00', '2026-07-31 01:26:18.554852+00', '{"eTag": "\"2ebd8ca48bc8842239167042aa7536cb\"", "size": 165959, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:26:19.000Z", "contentLength": 165959, "httpStatusCode": 200}', '6174696c-a4a6-425c-ada5-7fb419893313', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('33dd44f3-b2ba-4f2b-a305-65094785bbcf', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/0243ded5-276a-491d-a271-a7b39a392540/1785461190658-qhafy1.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:26:31.551989+00', '2026-07-31 01:26:31.551989+00', '2026-07-31 01:26:31.551989+00', '{"eTag": "\"2ebd8ca48bc8842239167042aa7536cb\"", "size": 165959, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:26:32.000Z", "contentLength": 165959, "httpStatusCode": 200}', '488ec34a-9fd9-406a-ae58-dfa72b2edc93', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('8cb90d94-ee6f-4de8-abd0-8ead6ccff440', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/1c27e8bc-339b-417f-b62a-a7719a68e6ed/8aadc065-68bd-4ee1-abf4-cb6d76765f28/1785461286504-4sxrx1.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:28:08.555452+00', '2026-07-31 01:28:08.555452+00', '2026-07-31 01:28:08.555452+00', '{"eTag": "\"4bb50fbd5b3615dae30bf475a78a3bd5\"", "size": 2622684, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:28:09.000Z", "contentLength": 2622684, "httpStatusCode": 200}', 'adfd90d3-7a14-4acb-935a-a88dfe879d34', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('1d2cdf86-e55d-494a-a9d8-191d389b65c6', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5/7e00fb0d-2f69-45fd-9d29-e9d5249c5bdc/1785461490713-dpdlcd.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:31:32.712513+00', '2026-07-31 01:31:32.712513+00', '2026-07-31 01:31:32.712513+00', '{"eTag": "\"fcc24d591bc0583989a9dc37a4386ce5\"", "size": 3214003, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:31:33.000Z", "contentLength": 3214003, "httpStatusCode": 200}', '77c4d4fe-6346-4601-aa34-cfd077b36d20', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('b60642e5-40aa-4a06-90f9-04bb6b97bcd2', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5/6aa74626-35a5-4ecc-8067-695924e667e5/1785461506112-948spm.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:31:47.796492+00', '2026-07-31 01:31:47.796492+00', '2026-07-31 01:31:47.796492+00', '{"eTag": "\"14dc6f59e4dea2487c51549daef4f99c\"", "size": 2386524, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:31:48.000Z", "contentLength": 2386524, "httpStatusCode": 200}', 'c0a9dcd4-8e5f-4f8e-8bf2-9ba4b35a6370', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('dd8f56e3-e23e-4599-ba43-675928472d08', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5/718eeb1d-f198-4127-b750-2cfe9d28e22d/1785461529861-kx9hsf.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:32:11.62826+00', '2026-07-31 01:32:11.62826+00', '2026-07-31 01:32:11.62826+00', '{"eTag": "\"46ac1fe9a79ce52eeda503208e7e5ae1\"", "size": 3479539, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:32:12.000Z", "contentLength": 3479539, "httpStatusCode": 200}', '290e6fb7-32e4-45de-8684-11229f2dd35d', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('15b33c2f-8a45-4ebc-965b-d8b1fe69c14c', 'finance-proofs', 'bf496ef5-ee27-429d-99d5-770d8b917c66/expenses/72f1309d-3b6e-49b0-b20a-8f4d6d04c4e5/77ccde7a-d656-4302-91df-0c86cfd30fa9/1785461576806-fwoilt.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:32:57.835255+00', '2026-07-31 01:32:57.835255+00', '2026-07-31 01:32:57.835255+00', '{"eTag": "\"3f2bade973da65476a511ae043ef53fe\"", "size": 181319, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:32:58.000Z", "contentLength": 181319, "httpStatusCode": 200}', '1de918e6-3be5-4d0d-9e87-33c02c6b9803', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('fae561de-c8fa-408f-8b21-53299bdd3715', 'vehicle-photos', 'bf496ef5-ee27-429d-99d5-770d8b917c66/129c1c35-e0e2-41fa-977f-35161dff381c/1785461889681-u6rtlh.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:38:10.825809+00', '2026-07-31 01:38:10.825809+00', '2026-07-31 01:38:10.825809+00', '{"eTag": "\"4966a57aaa328797b8d0da44f2c1cb2e\"", "size": 346534, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:38:11.000Z", "contentLength": 346534, "httpStatusCode": 200}', '73935564-b8f9-4158-b329-88e486cfdc4b', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('05d24987-653f-4b55-9fce-3a0ef89c3cea', 'vehicle-photos', 'bf496ef5-ee27-429d-99d5-770d8b917c66/8ae3388d-5818-4367-971a-78298eb10370/1785461951706-i88394.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:39:12.870811+00', '2026-07-31 01:39:12.870811+00', '2026-07-31 01:39:12.870811+00', '{"eTag": "\"1db0c15c29d59f0b02e302a5f79c3310\"", "size": 192563, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:39:13.000Z", "contentLength": 192563, "httpStatusCode": 200}', '29b78d28-23fa-42d6-a4ca-db315506c104', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('9ce56214-8b09-443d-8423-ca94850fd725', 'vehicle-photos', 'bf496ef5-ee27-429d-99d5-770d8b917c66/546e52eb-5e44-464f-8de8-ac244fdb2f92/1785461967761-5qyyzj.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:39:29.051208+00', '2026-07-31 01:39:29.051208+00', '2026-07-31 01:39:29.051208+00', '{"eTag": "\"16fdcfd26c296d635ec04c51796ae7b2\"", "size": 680159, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:39:29.000Z", "contentLength": 680159, "httpStatusCode": 200}', 'c2bf32a7-e4a3-4c90-8d9f-ca338f89b74e', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('c3321c1b-f772-44fc-b921-dfe22a55b3f5', 'vehicle-photos', 'bf496ef5-ee27-429d-99d5-770d8b917c66/120a14f0-2e31-4822-935c-443cd5179770/1785461978433-t4qmmz.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:39:39.380294+00', '2026-07-31 01:39:39.380294+00', '2026-07-31 01:39:39.380294+00', '{"eTag": "\"c56d323f42121c6c1c7d706454825925\"", "size": 707123, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:39:40.000Z", "contentLength": 707123, "httpStatusCode": 200}', 'bca6ac35-900f-4a80-8608-c90a156ca203', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('2dbf2d14-bf47-48ce-baf6-ac9538d09905', 'vehicle-photos', 'bf496ef5-ee27-429d-99d5-770d8b917c66/1c27e8bc-339b-417f-b62a-a7719a68e6ed/1785462036189-wri0pa.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:40:38.873719+00', '2026-07-31 01:40:38.873719+00', '2026-07-31 01:40:38.873719+00', '{"eTag": "\"45f8e7e18fc2d84760bba49880d6ef91\"", "size": 4793126, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:40:39.000Z", "contentLength": 4793126, "httpStatusCode": 200}', '872398e5-12b3-4134-b1f3-2bc1ff389d3b', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('98cdbe1d-d323-4aa5-9451-0e55ef0564fa', 'vehicle-photos', 'bf496ef5-ee27-429d-99d5-770d8b917c66/e874930a-e059-4084-afe2-dba5fce82128/1785462059295-cb2wuw.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:41:00.542789+00', '2026-07-31 01:41:00.542789+00', '2026-07-31 01:41:00.542789+00', '{"eTag": "\"c14d68a59506d0ee6f1753e91dbf4424\"", "size": 649877, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:41:01.000Z", "contentLength": 649877, "httpStatusCode": 200}', '2853f737-fd6b-4140-8235-4ac49f650533', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}'),
	('3e12cce6-8425-400e-b3d3-4ca41a6c6a83', 'vehicle-photos', 'bf496ef5-ee27-429d-99d5-770d8b917c66/72a10765-1ab6-4353-bb50-30e22fbf4fa0/1785462076334-edp8p7.jpg', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '2026-07-31 01:41:17.099476+00', '2026-07-31 01:41:17.099476+00', '2026-07-31 01:41:17.099476+00', '{"eTag": "\"64b2fca420043bdbe6a85482e6ae3af7\"", "size": 562518, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-07-31T01:41:18.000Z", "contentLength": 562518, "httpStatusCode": 200}', 'a3bba699-85c6-4236-a083-a21f7aeb826f', '03c73ded-1ef7-4d98-9910-228dcbd95b8c', '{}');


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 203, true);


--
-- Name: assistant_security_audit_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."assistant_security_audit_events_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict DG5s95bzJ3KMR5ddSJrAiPogWg1dlfEM2siGzhJwRmRMRzxr8gcgnjUSBJb3Hdp

RESET ALL;
