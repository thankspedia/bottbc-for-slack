
import { readSettings        } from  'asynchronous-context/settings' ;
import { loadContextFactory  } from  'asynchronous-context-rpc/context-factory-loader.mjs' ;

export function load_context_factory() {
  const settings = readSettings();
  const {
    context_factory,
    purge_require_cache,
  } = settings?.async_context_backend ?? {};

  return loadContextFactory( context_factory, purge_require_cache );
}

