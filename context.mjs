
// Load a module to read `.settings` file.
import { readSettings        } from  'asynchronous-context/settings' ;

// Load Context Factory Loader which is a module from async-context-rpc package.
import { loadContextFactory  } from  'asynchronous-context-rpc/context-factory-loader.mjs' ;

// Define a context factory; then, export it.
export function load_context_factory() {
  const settings = readSettings();
  const {
    context_factory,
  } = settings?.async_context_backend ?? {};

  return loadContextFactory( context_factory );
}


