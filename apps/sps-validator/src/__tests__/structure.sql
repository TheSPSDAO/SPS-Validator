--
-- PostgreSQL database dump
--

-- Dumped from database version 16.6
-- Dumped by pg_dump version 16.6 (Ubuntu 16.6-1.pgdg20.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: promise_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.promise_status AS ENUM (
    'open',
    'fulfilled',
    'completed',
    'cancelled'
);


--
-- Name: validator_check_in_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.validator_check_in_status AS ENUM (
    'active',
    'inactive'
);


SET default_table_access_method = heap;

--
-- Name: active_delegations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_delegations (
    token character varying(20) NOT NULL,
    delegator character varying(50) NOT NULL,
    delegatee character varying(50) NOT NULL,
    amount numeric(15,3) NOT NULL,
    last_delegation_tx character varying(100) NOT NULL,
    last_delegation_date timestamp with time zone NOT NULL,
    last_undelegation_date timestamp with time zone,
    last_undelegation_tx character varying(100)
);


--
-- Name: balance_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.balance_history (
    player character varying(50) NOT NULL,
    token character varying(20) NOT NULL,
    amount numeric(14,3) NOT NULL,
    balance_start numeric(15,3) NOT NULL,
    balance_end numeric(15,3) NOT NULL,
    block_num integer NOT NULL,
    trx_id character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    created_date timestamp without time zone NOT NULL,
    counterparty character varying(50)
);


--
-- Name: balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.balances (
    player character varying(50) NOT NULL,
    token character varying(20) NOT NULL,
    balance numeric(15,3) DEFAULT 0 NOT NULL
)
WITH (fillfactor='80');


--
-- Name: blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocks (
    block_num integer NOT NULL,
    block_id character varying(1024) NOT NULL,
    prev_block_id character varying(1024) NOT NULL,
    l2_block_id character varying(1024) NOT NULL,
    block_time timestamp without time zone NOT NULL,
    validator character varying(50),
    validation_tx character varying(100)
);


--
-- Name: config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config (
    group_name character varying(50) NOT NULL,
    group_type character varying(20) DEFAULT 'object'::character varying NOT NULL,
    name character varying(50) NOT NULL,
    index smallint DEFAULT 0 NOT NULL,
    value_type character varying(20) DEFAULT 'string'::character varying NOT NULL,
    value text,
    last_updated_date timestamp without time zone,
    last_updated_tx character varying(100)
);


--
-- Name: hive_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hive_accounts (
    name character varying(20) NOT NULL,
    authority jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: item_details_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.item_details_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    validator character varying(50) NOT NULL,
    token character varying(20) NOT NULL,
    block_num integer NOT NULL,
    block_time timestamp without time zone NOT NULL,
    token_price numeric(12,6) NOT NULL
);


--
-- Name: promise; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promise (
    id integer NOT NULL,
    ext_id text NOT NULL,
    type text NOT NULL,
    status public.promise_status NOT NULL,
    params jsonb NOT NULL,
    controllers text[] NOT NULL,
    fulfill_timeout_seconds integer,
    fulfilled_by text,
    fulfilled_at timestamp without time zone,
    fulfilled_expiration timestamp without time zone,
    created_date timestamp without time zone NOT NULL,
    updated_date timestamp without time zone NOT NULL
);


--
-- Name: promise_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promise_history (
    id integer NOT NULL,
    promise_id integer NOT NULL,
    action text NOT NULL,
    player text NOT NULL,
    previous_status public.promise_status,
    new_status public.promise_status NOT NULL,
    trx_id text NOT NULL,
    created_date timestamp without time zone NOT NULL
);


--
-- Name: promise_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promise_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promise_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promise_history_id_seq OWNED BY public.promise_history.id;


--
-- Name: promise_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promise_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promise_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promise_id_seq OWNED BY public.promise.id;


--
-- Name: staking_pool_reward_debt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staking_pool_reward_debt (
    player character varying(50) NOT NULL,
    pool_name character varying(50) NOT NULL,
    reward_debt numeric(15,3) DEFAULT 0 NOT NULL
);


--
-- Name: token_unstaking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_unstaking (
    player character varying(50) NOT NULL,
    unstake_tx character varying(100) NOT NULL,
    unstake_start_date timestamp without time zone NOT NULL,
    is_active boolean NOT NULL,
    token character varying(20) NOT NULL,
    total_qty numeric(15,3) NOT NULL,
    next_unstake_date timestamp without time zone NOT NULL,
    total_unstaked numeric(15,3) DEFAULT 0 NOT NULL,
    unstaking_periods smallint NOT NULL,
    unstaking_interval_seconds integer NOT NULL,
    cancel_tx character varying(100)
);


--
-- Name: validator_check_in; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validator_check_in (
    account text NOT NULL,
    status public.validator_check_in_status NOT NULL,
    last_check_in_block_num integer NOT NULL,
    last_check_in timestamp without time zone NOT NULL
);


--
-- Name: validator_transaction_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validator_transaction_players (
    transaction_id character varying(100) NOT NULL,
    player character varying(50) NOT NULL
);


--
-- Name: validator_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validator_transactions (
    id character varying(1024) NOT NULL,
    block_id character varying(1024) NOT NULL,
    prev_block_id character varying(1024) NOT NULL,
    type character varying(100) NOT NULL,
    player character varying(50) NOT NULL,
    data text,
    success boolean,
    error text,
    block_num integer,
    index smallint NOT NULL,
    created_date timestamp without time zone,
    result text
);
ALTER TABLE ONLY public.validator_transactions ALTER COLUMN data SET COMPRESSION lz4;
ALTER TABLE ONLY public.validator_transactions ALTER COLUMN result SET COMPRESSION lz4;


--
-- Name: validator_vote_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validator_vote_history (
    transaction_id character varying(100) NOT NULL,
    created_date timestamp without time zone NOT NULL,
    voter character varying(20) NOT NULL,
    validator character varying(20) NOT NULL,
    is_approval boolean NOT NULL,
    vote_weight numeric(12,3) NOT NULL
);


--
-- Name: validator_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validator_votes (
    voter character varying(20) NOT NULL,
    validator character varying(20) NOT NULL,
    vote_weight numeric(12,3) NOT NULL
);


--
-- Name: validators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validators (
    account_name character varying(20) NOT NULL,
    reward_account character varying(20) DEFAULT NULL::character varying,
    is_active boolean NOT NULL,
    post_url character varying(1024),
    total_votes numeric(12,3) DEFAULT 0 NOT NULL,
    missed_blocks integer DEFAULT 0 NOT NULL
);


--
-- Name: promise id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promise ALTER COLUMN id SET DEFAULT nextval('public.promise_id_seq'::regclass);


--
-- Name: promise_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promise_history ALTER COLUMN id SET DEFAULT nextval('public.promise_history_id_seq'::regclass);


--
-- Name: active_delegations active_delegations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_delegations
    ADD CONSTRAINT active_delegations_pkey PRIMARY KEY (token, delegator, delegatee);


--
-- Name: balances balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.balances
    ADD CONSTRAINT balances_pkey PRIMARY KEY (player, token);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (block_num);


--
-- Name: config config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config
    ADD CONSTRAINT config_pkey PRIMARY KEY (group_name, name);


--
-- Name: hive_accounts hive_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hive_accounts
    ADD CONSTRAINT hive_accounts_pkey PRIMARY KEY (name);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (validator, token);


--
-- Name: promise_history promise_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promise_history
    ADD CONSTRAINT promise_history_pkey PRIMARY KEY (id);


--
-- Name: promise promise_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promise
    ADD CONSTRAINT promise_pkey PRIMARY KEY (id);


--
-- Name: staking_pool_reward_debt staking_pool_reward_debt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staking_pool_reward_debt
    ADD CONSTRAINT staking_pool_reward_debt_pkey PRIMARY KEY (player, pool_name);


--
-- Name: token_unstaking token_unstaking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_unstaking
    ADD CONSTRAINT token_unstaking_pkey PRIMARY KEY (unstake_tx);


--
-- Name: validator_check_in validator_check_in_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validator_check_in
    ADD CONSTRAINT validator_check_in_pkey PRIMARY KEY (account);


--
-- Name: validator_transaction_players validator_transaction_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validator_transaction_players
    ADD CONSTRAINT validator_transaction_players_pkey PRIMARY KEY (transaction_id, player);


--
-- Name: validator_transactions validator_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validator_transactions
    ADD CONSTRAINT validator_transactions_pkey PRIMARY KEY (id);


--
-- Name: validator_vote_history validator_vote_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validator_vote_history
    ADD CONSTRAINT validator_vote_history_pkey PRIMARY KEY (transaction_id);


--
-- Name: validator_votes validator_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validator_votes
    ADD CONSTRAINT validator_votes_pkey PRIMARY KEY (voter, validator);


--
-- Name: validators validators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validators
    ADD CONSTRAINT validators_pkey PRIMARY KEY (account_name);


--
-- Name: balance_history_player_created_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX balance_history_player_created_date_idx ON public.balance_history USING btree (player, created_date);


--
-- Name: balance_history_token_player_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX balance_history_token_player_type_idx ON public.balance_history USING btree (token, player, type);


--
-- Name: idx_balance_history_created_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_history_created_date ON public.balance_history USING btree (created_date DESC);


--
-- Name: idx_balance_history_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_balance_history_player ON public.balance_history USING btree (player);


--
-- Name: idx_validator_check_in_last_check_in_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_validator_check_in_last_check_in_status ON public.validator_check_in USING btree (last_check_in_block_num, status);


--
-- Name: promise_history_promise_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promise_history_promise_id_idx ON public.promise_history USING btree (promise_id);


--
-- Name: promise_type_ext_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX promise_type_ext_id_idx ON public.promise USING btree (type, ext_id);


--
-- Name: validator_transaction_players_player_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX validator_transaction_players_player_idx ON public.validator_transaction_players USING btree (player);


--
-- Name: validator_transactions_block_num_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX validator_transactions_block_num_idx ON public.validator_transactions USING btree (block_num, index);


--
-- Name: validator_transactions_created_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX validator_transactions_created_date_idx ON public.validator_transactions USING btree (created_date);


--
-- Name: validator_transactions_type_player_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX validator_transactions_type_player_idx ON public.validator_transactions USING btree (player, type);


--
-- Name: validator_votes_validator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX validator_votes_validator_idx ON public.validator_votes USING btree (validator);


--
-- Name: validators_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX validators_active ON public.validators USING btree (is_active);


--
-- Name: validators_reward_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX validators_reward_account ON public.validators USING btree (reward_account);


--
-- Name: validators_total_votes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX validators_total_votes_idx ON public.validators USING btree (total_votes DESC);


--
-- PostgreSQL database dump complete
--

