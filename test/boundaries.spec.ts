import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The separation that keeps upgrades a version bump:
 *
 * - A design (the Default design or a Brand design) reaches commerce only through what the
 *   Storefront core exports. It never deep-imports the core, talks to the Shop API, or reads
 *   cookies itself.
 * - The Storefront core imports no design, no Brand and no CMS adapter.
 */

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const coreExports = Object.keys(
    (JSON.parse(read('packages/core/package.json')) as { exports: Record<string, string> }).exports,
).map(entry => path.posix.join('@getcart/storefront-core', entry));
const designExports = Object.keys(
    (JSON.parse(read('packages/design/package.json')) as { exports: Record<string, string> }).exports,
).map(entry => path.posix.join('@getcart/storefront-design', entry));

function sourceFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(path.join(root, directory))) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const relative = path.posix.join(directory, entry);
        if (statSync(path.join(root, relative)).isDirectory()) files.push(...sourceFiles(relative));
        else if (/\.(ts|tsx)$/.test(entry)) files.push(relative);
    }
    return files;
}

function imports(file: string): string[] {
    const source = read(file);
    const pattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
    return [...source.matchAll(pattern)].map(match => match[1]!);
}

/** A relative import may not leave the package it is in. */
function staysInside(file: string, specifier: string, packageDirectory: string): boolean {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    return target === packageDirectory || target.startsWith(`${packageDirectory}/`);
}

/** What a design may import from the core: the pure entry point and the server actions. */
const CORE_FOR_DESIGNS = ['@getcart/storefront-core', '@getcart/storefront-core/next/actions'];
const FRAMEWORK = ['react', 'next/link', 'next/navigation', 'next/image'];

function violations(directory: string, allowed: string[]): string[] {
    const found: string[] = [];
    for (const file of sourceFiles(directory)) {
        for (const specifier of imports(file)) {
            const ok = specifier.startsWith('.')
                ? staysInside(file, specifier, directory)
                : allowed.includes(specifier);
            if (!ok) found.push(`${file} imports "${specifier}"`);
        }
    }
    return found;
}

describe('package boundaries', () => {
    it('the design entry points a design may use are real core exports', () => {
        for (const specifier of CORE_FOR_DESIGNS) expect(coreExports).toContain(specifier);
    });

    it('the Default design imports only what the Storefront core exports', () => {
        expect(violations('packages/design/src', [...CORE_FOR_DESIGNS, ...FRAMEWORK])).toEqual([]);
    });

    it('Brand designs import only the Storefront core and the Default design', () => {
        expect(violations('brands', [...CORE_FOR_DESIGNS, ...designExports, ...FRAMEWORK])).toEqual([]);
    });

    it('the Storefront core imports no design, Brand, test helper or CMS adapter', () => {
        const forbidden = /storefront-(design|brands|testing)|payload|cms-/i;
        const found = sourceFiles('packages/core/src').flatMap(file =>
            imports(file)
                .filter(
                    specifier =>
                        forbidden.test(specifier) ||
                        (specifier.startsWith('.') && !staysInside(file, specifier, 'packages/core/src')),
                )
                .map(specifier => `${file} imports "${specifier}"`),
        );
        expect(found).toEqual([]);
    });

    it('only the server half of the core touches cookies, the transport or the session', () => {
        const pureEntry = sourceFiles('packages/core/src').filter(
            file => !/\/(server|next|shop)\//.test(file) && !file.endsWith('idempotency.ts'),
        );
        const found = pureEntry.flatMap(file =>
            imports(file)
                .filter(
                    specifier =>
                        /^(node:|next\/|server-only|graphql|gql\.tada)/.test(specifier) ||
                        /\/(server|next|shop)\//.test(specifier),
                )
                .map(specifier => `${file} imports "${specifier}"`),
        );
        expect(found).toEqual([]);
    });

    it('detects a violation (the check itself works)', () => {
        expect(
            staysInside('packages/design/src/a.tsx', '../../core/src/server/cookies', 'packages/design/src'),
        ).toBe(false);
        expect(imports('packages/design/src/payment-ui.tsx')).toContain(
            '@getcart/storefront-core/next/actions',
        );
    });
});
