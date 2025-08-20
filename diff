'use client'

import React, { useEffect, useState } from 'react';
import FileUploader from './components/FileUploader';
import YAMLDiffViewer from './components/DiffViewer';
import { getDiff, applySingleDiff, formatDiff } from '@/utils/diffUtils';
import { dumpYAML, parseYAML } from '@/utils/yarnUtils';
import { ValueOf } from 'next/dist/shared/lib/constants';
import TokenForm from './components/TokenForm';
import { APIS } from '@/utils/openShift';
import { loader } from '@/utils/misc';
import Modal from '@/ui/modal';
import yamlObj from 'js-yaml';

export interface IData {
  [key: string]: {
    url: string;
    token: string;
    env?: string;
  }
}

const Diff = () => {

  const View = {
    Form: 'form',
    File: 'file'
  } as const;
  type TView = ValueOf<typeof View>;

  const Type = {
    PODS: 'pods',
    SERV: 'services',
    depl: 'deployments',
    conf: 'configmaps'
  } as const;
  type TType = ValueOf<typeof Type>;

  const DefaultPaths = {
    'metadata.name': {
      checked: true
    },
    'metadata.namespace': {
      checked: true
    },
    'metadata.labels': {
      checked: true
    },
    'spec.replicas': {
      checked: true
    },
    'spec.template.spec.containers': {
      checked: true
    },
    'spec.template.spec.volumes': {
      checked: true
    }
  };

  const [data, setData] = useState<IData>(
    {
      project1: {
        url: '',
        token: '',
        env: ''
      },
      project2: {
        url: '',
        token: '',
        env: ''
      }
    });
  const [projectList, setProjectList] = useState({ project1: [], project2: [] });
  const [yaml, setYaml] = useState<any[]>([]);
  const [project, setProject] = useState<Record<string, string>>({ project1: '', project2: '' });
  const [yamlContents, setYamlContents] = useState<string[]>(['', '']);
  const [diffs, setDiffs] = useState<{ yaml1: any; yaml2: any }>({ yaml1: '', yaml2: '' });
  // const [view, setView] = useState<TView>(View.Form);
  const [pagination, setPagination] = useState(0);
  // const [podPairs, setPodPairs] = useState<any[]>([]);
  const [pairGroups, setPairGroups] = useState<any>();
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedType, setSelectedType] = useState<TType>();
  const [extraItems, setExtraItems] = useState<{ project1: any[], project2: any[] }>({ project1: [], project2: [] });
  const [defaultPaths, setDefaultPaths] = useState<Record<string, any>>(DefaultPaths);
  const [customPath, setCustomPath] = useState<string>('')

  const [steps, setSteps] = useState<Record<string, any>>({
    authorize: {
      name: 'authorize',
      icon: '😕',
      completed: true,
      current: true,
      display: 'Authorization'
    },
    namespace: {
      name: 'namespace',
      icon: '😃',
      completed: false,
      current: false,
      display: 'Namespace Selection'
    },
    domain: {
      name: 'domain',
      icon: '😍',
      completed: false,
      current: false,
      display: 'Domain Selection'
    },
    differences: {
      name: 'differences',
      icon: '😍',
      completed: false,
      current: false,
      display: 'Differences'
    }
  });
  const groupNumber = 20;
  const handleDiff = (yaml1: string, yaml2: string) => {
    if (yaml1 && yaml2) {
      const obj1 = parseYAML(yaml1);
      const obj2 = parseYAML(yaml2);
      const differences = getDiff(obj1, obj2, defaultPaths);
      return differences;
    }
  }

  const getDiffView = (yaml1: any, yaml2: any) => {
    const { lhs, rhs } = handleDiff(yaml1, yaml2);
    return <YAMLDiffViewer
      oldValue={lhs}
      newValue={rhs}
    />
  }

  const handleUpload = (content: string, index: number) => {
    const updated = [...yamlContents];
    updated[index] = content;
    setYamlContents(updated);

    const [yaml1, yaml2] = updated;
    // const diff = 
    getDiffView(yaml1, yaml2);
  };

  const handleData = (value: string, project: string, dataType: string) => {
    let newData = { ...data };
    if (dataType && newData[project]) {
      newData[project] = {
        ...newData[project],
        [dataType]: value,
        env: value.match(/[a-zA-Z]+[0-9]+/g)?.[0] ? value.match(/[a-zA-Z]+[0-9]+/g)?.[0] : ''
      }
    }
    setData(newData)
  }

  const handleMergeDiff = (diffItem: any) => {
    const targetObj = parseYAML(yamlContents[0]);
    applySingleDiff(targetObj, diffItem);
    const updatedYAML = dumpYAML(targetObj);
    const updated = [updatedYAML, yamlContents[1]];
    setYamlContents(updated);

    const obj1 = parseYAML(updated[0]);
    const obj2 = parseYAML(updated[1]);
    setDiffs(getDiff(obj1, obj2, defaultPaths));
  };

  const groupedCall = async (apiList: string[]): Promise<any[]> => {
    loader();
    const newData = data.slice(0, 2);
    const newPodListResult = apiList.map((api: string) => Promise.all(newData.map(({ token, url }) => fetch('/api/openshift', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        token,
        api
      }),
    }).then((res) => res.json()) // parse each response as JSON);
    ))
    );
    // console.log(newPodListResult);
    const result = await Promise.all(newPodListResult);
    // console.log(result);
    loader();
    return result;
  }

  const combinedCall = async (api: string, url: string, token: string): Promise<any[]> => {
    loader();

    const result = await fetch('/api/openshift', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        token,
        api
      }),
    }).then((res) => res.json());
    loader();
    // console.log(result);
    return result;
  }

  /**
   * [{url1, token1}, {url2, token2}]
   * {project1 : podList[], project2: podList[]}
   */

  const fetchProject = async () => {
    // await fetch('/api/token', {
    //   method: 'GET',
    //    headers: {
    //     'Content-Type': 'application/json',
    //   }
    // })
    if ((data.project1.url && data.project1.token) || (data.project2.url && data.project2.token)) {
      let result1: any = await combinedCall(APIS.projects(), data?.project1.url, data?.project1.token);
      let result2: any = await combinedCall(APIS.projects(), data?.project2.url, data?.project2.token);
      // setProjectList(result.message.items);
      setProjectList({ project1: result1.message.items, project2: result2.message.items });
      completeStep('authorize', 'namespace');
    }
  };

  const createListGroups = (pairs: any[]) => {
    const foundGroups: any[] = [];
    let groups: any = {};
    pairs.forEach(({ metadata1, metadata2 }: any, index: number) => {
      const subGroup1 = metadata1.labels["app.kubernetes.io/part-of"];
      const subGroup2 = metadata2.labels["app.kubernetes.io/part-of"];
      const subGroup = subGroup1 === subGroup2 ? subGroup1 : undefined
      if (subGroup && foundGroups.includes(subGroup1)) {
        const currentData = groups[subGroup];
        groups = {
          ...groups,
          [subGroup]: [...currentData, { metadata1, metadata2 }]
        };
      } else if (!foundGroups.includes(subGroup)) {
        foundGroups.push(subGroup);
        groups = {
          ...groups,
          [subGroup]: [{ metadata1, metadata2 }]
        }
      }
    });
    // podList.project1.forEach((item: any, index: number) => {
    //   const subGroup = item.metadata.labels["app.kubernetes.io/part-of"];
    //   if (subGroup && foundGroups.findIndex(subGroup) > -1) {
    //     const currentData = groups[subGroup];
    //     groups = {
    //       ...groups,
    //       [subGroup]: [...currentData, item]
    //     };
    //   } else if (foundGroups.findIndex(subGroup) === -1) {
    //     foundGroups.push(subGroup);
    //     groups = {
    //       ...groups,
    //       [subGroup]: [item]
    //     }
    //   }
    // });
    setPairGroups(groups);
  }

  const completeStep = (currentStep: string, nextStep: string) => {
    setSteps((prevState) => {
      const newObj = { ...prevState };
      Object.values(newObj).forEach((item) => item.current = false);
      if (currentStep) {
        newObj[currentStep] = {
          ...newObj[currentStep],
          current: false,
          completed: true
        }
      }
      if (nextStep) {
        newObj[nextStep] = {
          ...newObj[nextStep],
          current: true,
          completed: true
        }
      }
      return newObj;
    });
  }

  const fetchList = async (api1: string, api2: string, types: TType) => {
    if ((data.project1.url && data.project1.token) || (data.project2.url && data.project2.token) && project.project1 && project.project2) {
      let result1: any = await combinedCall(api1, data?.project1.url, data?.project1.token);
      let result2: any = await combinedCall(api2, data?.project2.url, data?.project2.token);
      // setConfigList({ project1: result1.message.items, project2: result2.message.items });
      const pairs = getListPairs({ project1: result1.message.items, project2: result2.message.items });
      if (pairs) {
        createListGroups(pairs);
      }
      completeStep('namespace', 'domain');
      setSelectedType(types);
    }
  }


  const getListPairs = (list: { project1: any[], project2: any[] }) => {
    if (list.project1.length && list.project2.length) {
      // list.project1 contains all pods of project1 similarly for project2.
      const listPairs: any[] = [];
      const extraItemsInProject2: any[] = [];
      const extraItemsInProject1: any[] = [];
      list.project1.forEach(({ metadata }: { metadata: any }) => {
        const found = list.project2.find(({ metadata: metadata1 }: { metadata: any }) => {
          if (metadata.labels?.['app.kubernetes.io/instance']?.includes(metadata1.labels?.['app.kubernetes.io/instance'])) {
            listPairs.push({ metadata1: metadata, metadata2: metadata1 });
            return true;
          }
        });
        if (!found) {
          extraItemsInProject1.push(metadata);
        }
      });
      list.project2.forEach(({ metadata }: { metadata: any }) => {
        const found = list.project1.find(({ metadata: metadata1 }: { metadata: any }) => {
          if (metadata.labels?.['app.kubernetes.io/instance']?.includes(metadata1.labels?.['app.kubernetes.io/instance'])) {
            return true;
          }
        });
        if (!found) {
          extraItemsInProject2.push(metadata);
        }
      });
      setExtraItems({ project1: extraItemsInProject1.filter((item) => item.labels.app), project2: extraItemsInProject2.filter((item) => item.labels.app) })
      /**
       * [{metadata1, metadata2}]
       * data.project1, data.project2
       * similar pods are paired from project1 and project2.
       */
      if (listPairs.length) {
        // setPodPairs(podPairs);
        return listPairs;
      }
    }
  }

  const getGroupedPodYaml = async () => {
    if (selectedType && selectedGroup && pairGroups[selectedGroup]) {
      const yamlPairs: any[] = []
      loader();
      const itemToFetch = pagination + groupNumber;
      setPagination(itemToFetch);
      await Promise.all(pairGroups[selectedGroup].slice(pagination, itemToFetch).map(async ({ metadata1, metadata2 }: any) => {
        const yaml1: any = await combinedCall(APIS.yaml(project.project1, selectedType, metadata1.name), data.project1.url, data.project1.token);
        const yaml2: any = await combinedCall(APIS.yaml(project.project2, selectedType, metadata2.name), data.project2.url, data.project2.token);
        if (yaml1 && yaml2) {
          yamlPairs.push({ yaml1: yaml1.message, yaml2: yaml2.message });
        }
      }));
      // pairGroups[selectedGroup]?.map(({metadata1, metadata2}: any) => {
      //   yamlPairs.push({yaml1: metadata1, yaml2: metadata2});
      // })
      loader();
      setYaml((prevState) => [...prevState, ...yamlPairs]);
      completeStep('domain', 'differences');
    }
  }

  const Namespace = () => (
    <div className='flex flex-col'>
      <div className='bg-bse-300 flex bg-base-200 justify-center items-center'>
        <fieldset className="fieldset w-1/3 m-1 p-10">
          <legend className="fieldset-legend">Pod Namespace 1</legend>
          <select value={project.project1} className="select text-base-content" onChange={(e) => setProject((prevState) => ({ ...prevState, project1: e.target.value as TView }))}>
            <option disabled={true}>Select a namespace</option>
            {
              projectList?.project1?.map(({ metadata }: { metadata: any }) => <option key={metadata.name} value={metadata.name}>{metadata.name}</option>)
            }
          </select>
        </fieldset>
        <fieldset className="fieldset  w-1/3 m-1 p-10">
          <legend className="fieldset-legend">Pod Namespace 2</legend>
          <select value={project.project2} className="select text-base-content" onChange={(e) => setProject((prevState) => ({ ...prevState, project2: e.target.value as TView }))}>
            <option disabled={true}>Select a namespace</option>
            {
              projectList?.project2?.map(({ metadata }: { metadata: any }) => <option key={metadata.name} value={metadata.name}>{metadata.name}</option>)
            }
          </select>
        </fieldset>
      </div>
      <div className='flex justify-center items-center'>
        {project.project1 && project.project2 ?
          <button
            onClick={() => fetchList(APIS.pods(project.project1), APIS.pods(project.project2), Type.PODS)}
            className="btn-circle btn btn-base-300 text-base-content m-2 -bottom-10 w-20 h-20"
          >
            Fetch Pods
          </button> : null}
        {project.project1 && project.project2 ?
          <button
            onClick={() => fetchList(APIS.services(project.project1), APIS.services(project.project2), Type.SERV)}
            className="btn-circle btn btn-base-300 text-base-content m-2 -bottom-10 w-20 h-20"
          >
            Fetch Services
          </button> : null}
        {project.project1 && project.project2 ?
          <button
            onClick={() => fetchList(APIS.deployments(project.project1), APIS.deployments(project.project2), Type.depl)}
            className="btn-circle btn btn-base-300 text-base-content m-2 -bottom-10 w-20 h-20"
          >
            Fetch Deployments
          </button> : null}
        {project.project1 && project.project2 ?
          <button
            onClick={() => fetchList(APIS.configList(project.project1), APIS.configList(project.project2), Type.conf)}
            className="btn-circle btn btn-base-300 text-base-content m-2 -bottom-10 w-20 h-20"
          >
            Fetch Configs
          </button> : null}
      </div>
    </div>
  );

  const Domain = ({ pairGroups }: any) => (
    <>
      {pairGroups && Object.keys(pairGroups).length ? <>
        <fieldset className="fieldset m-1 p-10">
          <legend className="fieldset-legend">Select Domain</legend>
          <select value={selectedGroup} className="select text-base-content" onChange={(e) => {
            setSelectedGroup(e.target.value);
            setPagination(0);
          }}>
            <option>Select a domain</option>
            {
              Object.keys(pairGroups)?.map((item: string) => <option key={item} value={item}>{item}</option>)
            }
          </select>
          <div className='flex flex-wrap'>
            <fieldset className="fieldset m-1 p-10">
              <legend className="fieldset-legend">Select options which you want to check while filter</legend>
              {
                Object.keys(defaultPaths).map((item: any) =>
                  <div className='flex items-center'>
                    <input onChange={(e) => {
                      setDefaultPaths((prevState) => {
                        const { checked, value } = e.target;
                        const currentVal = { ...prevState };
                        currentVal[value] = {
                          checked
                        }
                        return currentVal;
                      })
                    }} type="checkbox" className="checkbox mr-2" value={item} name={item} checked={defaultPaths[item].checked} />
                    <label className="label text-base-content">{item}</label>
                  </div>
                )
              }

            </fieldset>
            <fieldset className="fieldset m-1 p-10">
              <legend className="fieldset-legend">Add your own paths</legend>
              <input className='input text-base-content' value={customPath} onChange={(e) => setCustomPath(e.target.value)} /> <button className='btn btn-success' disabled={!customPath} onClick={(e) => {
                setDefaultPaths((prevState) => {
                  const currentVal = { ...prevState };
                  setCustomPath('')
                  currentVal[customPath] = {
                    checked: true
                  }
                  return currentVal;
                })
              }

              }>Add Path</button>
            </fieldset>
          </div>
          {selectedGroup && pairGroups[selectedGroup] ?
            <div className='w-full flex items-center justify-center m-4'>
              <span className='text-base-content text-lg'>{`Total items present in the ${selectedGroup} of ${project.project1} is ${pairGroups[selectedGroup].length}`}</span>
              <button
                onClick={getGroupedPodYaml}
                className="btn-circle absolute btn btn-base-300 text-base-content m-2 -bottom-10 w-20 h-20"
              >
                {`Compare ${pairGroups[selectedGroup].length} items`}
              </button>
            </div>
            : null}
        </fieldset></> : null}</>
  );

  const Differences = () => (<div className='flex w-full bg-base-200 justify-between items-center flex-col p-4'>
    <table className='table sticky top-0'>
      <thead>
        <tr>
          <th className=''>Environment</th>
          <th>{data.project1.env}</th>
          <th>{data.project2.env}</th>
        </tr>
        <tr>
          <th className=''>Domain</th>
          <th>{selectedGroup}</th>
          <th>{selectedGroup}</th>
        </tr>
      </thead>
    </table>
    <div className='w-full flex flex-col'>
      <div className='w-full'>
        {extraItems.project1.length ? <div className="w-full bg-base-100 border-base-300 collapse collapse-arrow border">
          <input type="checkbox" className="peer" />
          <div
            className="collapse-title peer-checked:bg-secondary"
          >
            Number of <span className='capitalize'> {selectedType}</span>{` present in ${data.project1.env} but not in ${data.project2.env}: ${extraItems.project1.length}`}
          </div>
          <div
            className="collapse-content"
          >
            <div className='flex items-center w-full m-2 overflow-x-auto rounded-box border border-base-content/5 bg-base-100'>
              <ul>
                {
                  extraItems.project1.map(({ labels }) => <li><div className="inline-grid *:[grid-area:1/1]">
                    <div className="status status-error animate-ping"></div>
                    <div className="status status-error"></div>
                  </div>{`  ${labels?.app}`}</li>)
                }
              </ul>
            </div>
          </div>
        </div> : null}
        {extraItems.project2.length ? <div className="w-full bg-base-100 border-base-300 collapse collapse-arrow border">
          <input type="checkbox" className="peer" />
          <div
            className="collapse-title peer-checked:bg-secondary"
          >
            Number of <span className='capitalize'>{selectedType}</span>{` present in ${data.project2.env} but not in ${data.project1.env}: ${extraItems.project2.length}`}
          </div>
          <div
            className="collapse-content"
          >
            <div className='flex items-center w-full m-2 overflow-x-auto rounded-box border border-base-content/5 bg-base-100'>
              <ul>
                {
                  extraItems.project2.length ?
                    extraItems.project2.map(({ labels }) => <li><div className="inline-grid *:[grid-area:1/1]">
                      <div className="status status-error animate-ping"></div>
                      <div className="status status-error"></div>
                    </div>{`  ${labels?.app}`}</li>) : null
                }
              </ul>
            </div>
          </div>
        </div> : null}

      </div>
    </div>
    {yaml.length ? yaml.map(({ yaml1, yaml2 }, index) =>
    (
      <div className="w-full bg-base-100 border-base-300 collapse collapse-arrow border">
        <input type="checkbox" className="peer" />
        <div
          className="collapse-title bg-primary text-primary-content peer-checked:bg-secondary peer-checked:text-secondary-content uppercase"
        >
          {yaml1?.metadata?.labels?.release || yaml1?.metadata?.labels?.app}
        </div>
        <div
          className="collapse-content bg-primary text-primary-content peer-checked:bg-secondary peer-checked:text-secondary-content"
        >
          <div className='flex items-center w-full m-2 overflow-x-auto rounded-box border border-base-content/5 bg-base-100'>
            <table className='table' style={{ color: 'black' }}>
              <tbody className='p-1'>
                {
                  getDiff(yaml1, yaml2, defaultPaths).length ? formatDiff(getDiff(yaml1, yaml2, defaultPaths))?.map((f: any, i) => <tr key={i}><td>{f?.path}</td><td>{f?.lhs}</td><td>{f?.rhs}</td></tr>) : <div className='text-base-content p-1'>No differences found around your passed paths.</div>
                }
              </tbody>
            </table>
            <div className='w-1/5'><button className='btn' onClick={() => setDiffs({ yaml1, yaml2 })}>view diff</button></div>
          </div>
        </div>
      </div>
    )
    ) : null}
  </div>);

  return (
    <div className='w-full bg-base-200 h-full'>
      <div className='w-full flex items-center justify-center mt-1 mb-5'>
        <ul className="steps w-full">
          {
            Object.values(steps).map(({ completed, icon, name, current, display }) => (
              <li className={`step ${completed ? 'step-neutral' : ''} leading-[1.5] text-base-content`} onClick={() => completed ? setSteps((prevState) => {
                const newObj = { ...prevState };
                Object.values(newObj).forEach((item) => item.current = false);
                return {
                  ...newObj,
                  [name]: {
                    name,
                    completed,
                    icon,
                    current: true
                  }
                }
              }) : null}>
                <span className="step-icon" style={current ? { fontSize: '1.3rem' } : {}}>{icon}</span>{display}
              </li>
            ))
          }
        </ul>
      </div>
      <div className='w-full flex justify center items-center'>
        <div className='w-full'>
          <div className={`w-full justify-center items-center relative ${steps.authorize.current ? 'flex' : 'hidden'}`}>
            <TokenForm handleData={handleData} data={data} project='project1' index={1} />
            <TokenForm handleData={handleData} data={data} project='project2' index={2} />
            {!projectList?.project1?.length || !projectList?.project2?.length ?
              <button
                onClick={fetchProject}
                className="btn-circle absolute btn btn-base-300 text-base-content m-2 -bottom-10 w-20 h-20"
              >
                Submit
              </button> : null}
          </div>
          <div className={`w-full justify-center items-center relative ${steps.namespace.current ? 'flex' : 'hidden'}`}>
            <Namespace />
          </div>
          <div className={`w-full justify-center items-center relative ${steps.domain.current ? 'flex' : 'hidden'}`}>
            <Domain pairGroups={pairGroups} />
          </div>
          <div className={`w-full justify-center items-center relative ${steps.differences.current ? 'flex' : 'hidden'} text-base-content text-wrap`}>
            <Differences />
          </div>
        </div>
      </div>
      {diffs.yaml1 && diffs.yaml2 && <Modal
        isModalOpen={true}
        closeModal={() => setDiffs({ yaml1: '', yaml2: '' })}
        error={<></>}
      >
        <YAMLDiffViewer oldValue={yamlObj.dump(diffs.yaml1)} newValue={yamlObj.dump(diffs.yaml2)} splitView={true} />
      </Modal>}
    </div>
  );
};

export default Diff;


import { diff, applyChange } from 'deep-diff';

export const cleanObj = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(cleanObj)
  }

  const newObj: any = {};

  for (const key of Object.keys(obj)) {
    if (['creationTimestamp', 'resourceVersion', 'uid', 'generation', 'managedFields', 'selfLink', 'status'].includes(key)) {
      continue;
    }
    if (key === 'annotations') {
      const filteredAnnot = {...obj[key]};
      delete filteredAnnot["kubectl.kubernetes.io/last-applied-configuration"];
      if (Object.keys(filteredAnnot).length) {
        newObj[key] = cleanObj(filteredAnnot);
      }
      continue;
    }
    newObj[key] = cleanObj(obj[key]);
  }
  return newObj;
}

export const getDiff = (obj1: any, obj2: any, defaultPaths: any) => {
  const differences = diff(cleanObj(obj1), cleanObj(obj2)) || [];
  const diffs = differences.filter((d: any) => {
    if (!d.path) return false;
    const path = d.path.join(".");
    const updatedDefaultPath = Object.keys(defaultPaths).filter((item) => {
      if (defaultPaths[item].checked) {
        return item
      }
      return;
    })
    return (updatedDefaultPath.includes(path));
  });
  console.log('diffs', diffs)
  return diffs;
};

export const formatDiff = (diffs: any[]) => {
  return diffs.map((d: any) => {
    const path = d.path.join(".");
    switch(d.kind) {
      case "E": 
      return {path, lhs: d.lhs, rhs: d.rhs};
      default: 
      return null;
    }
  })
}

export const applySingleDiff = (target: any, diffItem: any) => {
  applyChange(target, {}, diffItem);
};
