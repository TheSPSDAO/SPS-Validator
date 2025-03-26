import { Link } from 'react-router-dom';
import { Validator } from '../services/openapi';

export type ValidatorNameProps = Pick<Validator, 'account_name' | 'api_url' | 'post_url'> & {
    link_to_validator?: boolean;
};

export function ValidatorName({ account_name, api_url, post_url, link_to_validator }: ValidatorNameProps) {
    return (
        <span>
            {link_to_validator && (
                <Link to={`/validator-nodes?node=${encodeURIComponent(account_name)}`} className="text-blue-600 underline dark:text-blue-500">
                    {account_name}
                </Link>
            )}
            {!link_to_validator && <span>{account_name}</span>} (
            {api_url && (
                <a href={api_url.replace(/\/$/, "") + "/status"} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline dark:text-blue-500">
                    api
                </a>
            )}
            {!api_url && <span className="text-red-500">no api</span>}
            {' | '}
            {post_url && (
                <a href={post_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline dark:text-blue-500">
                    peakd post
                </a>
            )}
            {!post_url && <span color="red" className="text-red-500">no peakd post</span>})
        </span>
    );
}
